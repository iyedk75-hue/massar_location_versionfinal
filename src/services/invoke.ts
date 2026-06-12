import { invoke } from "@tauri-apps/api/core";

type CollectionCommand = "cars" | "clients" | "reservations" | "payments" | "contracts";
type FallbackAuthUser = {
  fullName: string;
  id: number;
  password: string;
  username: string;
};
type FallbackSessionUser = Omit<FallbackAuthUser, "password">;

const defaultCollections: Record<CollectionCommand, unknown[]> = {
  cars: [],
  clients: [],
  reservations: [],
  payments: [],
  contracts: [],
};
const authUsersStorageKey = "rentaldesk:auth-users";
const authSessionStorageKey = "rentaldesk:auth-session";
const fallbackSeedVersionStorageKey = "rentaldesk:fallback-seed-version";
const fallbackSeedVersion = "100-clients-cars-v1";
const fallbackSeedNotePrefix = "[seed-demo]";
const devDefaultUser: FallbackAuthUser = {
  fullName: "Dev Admin",
  id: 1,
  password: "admin12345",
  username: "admin",
};

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return invoke<T>(command, args);
  }

  return invokeFallback<T>(command, args);
}

function invokeFallback<T>(command: string, args?: Record<string, unknown>): T {
  if (command === "get_auth_state") {
    return buildFallbackAuthState() as T;
  }

  if (command === "register_user") {
    const users = readAuthUsers();
    if (users.length > 0) {
      throw new Error("Un compte existe déjà. Connectez-vous pour continuer.");
    }
    const data = (args?.data ?? {}) as Record<string, unknown>;
    const fullName = String(data.fullName ?? "").trim();
    const username = normalizeAuthUsername(String(data.username ?? ""));
    const password = String(data.password ?? "");

    if (fullName.length < 2) throw new Error("Le nom complet doit contenir au moins 2 caractères.");
    if (username.length < 3) throw new Error("Le nom d'utilisateur doit contenir au moins 3 caractères.");
    if (password.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères.");

    const user: FallbackAuthUser = {
      fullName,
      id: Date.now(),
      password,
      username,
    };
    writeAuthUsers([...users, user]);
    writeAuthSession(toSessionUser(user));
    return buildFallbackAuthState() as T;
  }

  if (command === "login_user") {
    const data = (args?.data ?? {}) as Record<string, unknown>;
    const users = readAuthUsers();
    if (users.length === 0) {
      return buildFallbackAuthState() as T;
    }

    const username = normalizeAuthUsername(String(data.username ?? ""));
    const password = String(data.password ?? "");
    const user = users.find((candidate) => candidate.username === username);
    if (!user || user.password !== password) {
      throw new Error("Identifiants invalides.");
    }

    writeAuthSession(toSessionUser(user));
    return buildFallbackAuthState() as T;
  }

  if (command === "logout_user") {
    clearAuthSession();
    return buildFallbackAuthState() as T;
  }

  ensureFallbackDemoData();

  if (command === "save_database_copy" || command === "mount_existing_database") {
    throw new Error("Cette action est disponible uniquement dans l'application desktop.");
  }

  if (command === "seed_ai_sample_data") {
    return seedFallbackAIData() as T;
  }

  if (command === "get_dashboard_stats") {
    const cars = readCollection<Record<string, unknown>>("cars").filter((item) => item.archived !== true);
    const reservations = readCollection<Record<string, unknown>>("reservations").filter((item) => item.archived !== true);
    const payments = readCollection<Record<string, unknown>>("payments").filter((item) => item.archived !== true);
    const monthlyRevenue = payments
      .filter((payment) => payment.type === "RENTAL_PAYMENT")
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    return {
      totalCars: cars.length,
      availableCars: cars.filter((car) => car.status === "AVAILABLE").length,
      rentedCars: cars.filter((car) => car.status === "RENTED").length,
      ongoingReservations: reservations.filter((reservation) => reservation.status === "ONGOING").length,
      todayReservations: 0,
      monthlyRevenue,
      overduePayments: 0,
      insuranceAlerts: countDueSoon(cars, "insuranceExpiryDate"),
      technicalVisitAlerts: countDueSoon(cars, "technicalVisitExpiryDate"),
    } as T;
  }

  const getMatch = command.match(/^get_(cars|clients|reservations|payments|contracts)$/);
  if (getMatch) {
    return readCollection<Record<string, unknown>>(getMatch[1] as CollectionCommand).filter((item) => item.archived !== true) as T;
  }

  const createMatch = command.match(/^create_(car|client|reservation|payment|contract)$/);
  if (createMatch) {
    const collection = `${createMatch[1]}s` as CollectionCommand;
    const now = new Date().toISOString();
    if (command === "create_reservation") {
      validateFallbackReservation(args?.data as Record<string, unknown>);
    }
    if (command === "create_payment") {
      validateFallbackPayment(args?.data as Record<string, unknown>);
    }
    if (command === "create_client") {
      validateFallbackClient(args?.data as Record<string, unknown>);
    }
    const item = {
      id: Date.now(),
      ...(args?.data as object),
      ...(command === "create_client" ? { isActive: true } : {}),
      createdAt: now,
      updatedAt: now,
    };
    const current = readCollection(collection);
    writeCollection(collection, [...current, item]);
    return item as T;
  }

  const updateMatch = command.match(/^update_(car|client)$/);
  if (updateMatch) {
    const collection = `${updateMatch[1]}s` as CollectionCommand;
    const id = Number(args?.id);
    const data = args?.data as object;
    if (command === "update_client") {
      validateFallbackClient(data as Record<string, unknown>, id);
    }
    const updated = readCollection<Record<string, unknown>>(collection).map((item) =>
      item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item,
    );
    writeCollection(collection, updated);
    return updated.find((item) => item.id === id) as T;
  }

  const deleteMatch = command.match(/^delete_(car|client)$/);
  if (deleteMatch) {
    const collection = `${deleteMatch[1]}s` as CollectionCommand;
    const id = Number(args?.id);
    const now = new Date().toISOString();
    writeCollection(
      collection,
      readCollection<Record<string, unknown>>(collection).map((item) =>
        item.id === id
          ? { ...item, archived: true, archivedAt: now, archivedReason: "Suppression logique", updatedAt: now }
          : item,
      ),
    );
    return undefined as T;
  }

  if (command === "change_car_status") {
    const id = Number(args?.id);
    const updated = readCollection<Record<string, unknown>>("cars").map((car) =>
      car.id === id ? { ...car, status: args?.status, updatedAt: new Date().toISOString() } : car,
    );
    writeCollection("cars", updated);
    return updated.find((car) => car.id === id) as T;
  }

  if (command === "update_reservation_status") {
    const id = Number(args?.id);
    const data = args?.data as { status: string; returnMileage?: number; returnFuelLevel?: string };
    const reservations = readCollection<Record<string, unknown>>("reservations");
    const target = reservations.find((reservation) => reservation.id === id);
    if (data.status === "CANCELLED" && target && target.status !== "EN_ATTENTE" && target.status !== "RESERVED") {
      throw new Error("Seules les réservations à venir peuvent être annulées.");
    }
    if (
      data.status === "ONGOING" &&
      target &&
      reservations.some(
        (reservation) =>
          reservation.archived !== true &&
          Number(reservation.id) !== id &&
          Number(reservation.carId) === Number(target.carId) &&
          reservation.status === "ONGOING",
      )
    ) {
      throw new Error("Cette voiture a deja une location en cours. Terminez-la avant de demarrer une autre reservation.");
    }
    const updatedReservations = reservations.map((reservation) =>
      reservation.id === id ? { ...reservation, ...data, updatedAt: new Date().toISOString() } : reservation,
    );
    writeCollection("reservations", updatedReservations);

    if (target) {
      const carStatus = data.status === "ONGOING" ? "RENTED" : ["COMPLETED", "CANCELLED"].includes(data.status) ? "AVAILABLE" : null;
      if (carStatus) {
        invokeFallback("change_car_status", { id: target.carId, status: carStatus });
      }
      if (data.status === "COMPLETED" && data.returnMileage != null && Number.isFinite(Number(data.returnMileage))) {
        const cars = readCollection<Record<string, unknown>>("cars").map((car) =>
          Number(car.id) === Number(target.carId)
            ? { ...car, mileage: Number(data.returnMileage), updatedAt: new Date().toISOString() }
            : car,
        );
        writeCollection("cars", cars);
      }
      if (data.status === "ONGOING") {
        createFallbackContract(id);
      }
    }

    return updatedReservations.find((reservation) => reservation.id === id) as T;
  }

  if (command === "deactivate_client" || command === "reactivate_client") {
    const id = Number(args?.id);
    const isActive = command === "reactivate_client";
    const updated = readCollection<Record<string, unknown>>("clients").map((client) =>
      client.id === id ? { ...client, isActive, updatedAt: new Date().toISOString() } : client,
    );
    writeCollection("clients", updated);
    return updated.find((client) => client.id === id) as T;
  }

  if (command === "delete_reservation") {
    const id = Number(args?.id);
    const now = new Date().toISOString();
    const reservations = readCollection<Record<string, unknown>>("reservations");
    const reservation = reservations.find((item) => item.id === id);

    writeCollection(
      "payments",
      readCollection<Record<string, unknown>>("payments").map((payment) =>
        payment.reservationId === id
          ? { ...payment, archived: true, archivedAt: now, archivedReason: "Réservation archivée" }
          : payment,
      ),
    );
    writeCollection(
      "contracts",
      readCollection<Record<string, unknown>>("contracts").map((contract) =>
        contract.reservationId === id
          ? { ...contract, archived: true, archivedAt: now, archivedReason: "Réservation archivée" }
          : contract,
      ),
    );
    writeCollection(
      "reservations",
      reservations.map((item) =>
        item.id === id
          ? { ...item, archived: true, archivedAt: now, archivedReason: "Suppression logique", updatedAt: now }
          : item,
      ),
    );

    if (reservation?.status === "ONGOING") {
      invokeFallback("change_car_status", { id: reservation.carId, status: "AVAILABLE" });
    }

    return undefined as T;
  }

  if (command === "update_reservation") {
    const id = Number(args?.id);
    const data = args?.data as Record<string, unknown>;
    const reservations = readCollection<Record<string, unknown>>("reservations");
    const target = reservations.find((reservation) => reservation.id === id);
    if (!target) throw new Error("Réservation introuvable.");
    if (target.status === "ONGOING" || target.status === "COMPLETED" || target.status === "CANCELLED") {
      throw new Error("Une location en cours doit être clôturée avant modification.");
    }
    validateFallbackReservation(data, id);
    const updated = reservations.map((reservation) =>
      reservation.id === id ? { ...reservation, ...data, updatedAt: new Date().toISOString() } : reservation,
    );
    writeCollection("reservations", updated);
    return updated.find((reservation) => reservation.id === id) as T;
  }

  if (command === "generate_contract") {
    return createFallbackContract(Number(args?.reservationId)) as T;
  }

  return [] as T;
}

function readCollection<T = unknown>(collection: CollectionCommand): T[] {
  const key = storageKey(collection);
  const stored = window.localStorage.getItem(key);
  if (!stored) {
    const defaults = defaultCollections[collection] as T[];
    writeCollection(collection, defaults);
    return defaults;
  }

  return JSON.parse(stored) as T[];
}

function writeCollection(collection: CollectionCommand, value: unknown[]) {
  window.localStorage.setItem(storageKey(collection), JSON.stringify(value));
}

function ensureFallbackDemoData() {
  if (window.localStorage.getItem(fallbackSeedVersionStorageKey) === fallbackSeedVersion) {
    return;
  }

  const clients = readCollection<Record<string, unknown>>("clients");
  const cars = readCollection<Record<string, unknown>>("cars");
  const reservations = readCollection<Record<string, unknown>>("reservations");
  const shouldReplace = clients.length <= 1 && cars.length <= 1 && reservations.length <= 1;

  if (!shouldReplace && clients.length >= 100 && cars.length >= 100 && reservations.length >= 100) {
    window.localStorage.setItem(fallbackSeedVersionStorageKey, fallbackSeedVersion);
    return;
  }

  const demo = buildFallbackDemoData();

  if (shouldReplace) {
    writeCollection("clients", demo.clients);
    writeCollection("cars", demo.cars);
    writeCollection("reservations", demo.reservations);
    writeCollection("payments", demo.payments);
    writeCollection("contracts", demo.contracts);
  } else {
    writeCollection("clients", mergeSeededCollection(clients, demo.clients, "phone"));
    writeCollection("cars", mergeSeededCollection(cars, demo.cars, "registrationNumber"));
    writeCollection("reservations", mergeSeededCollection(reservations, demo.reservations, "notes"));
    writeCollection("payments", readCollection("payments"));
    writeCollection("contracts", readCollection("contracts"));
  }

  window.localStorage.setItem(fallbackSeedVersionStorageKey, fallbackSeedVersion);
}

function mergeSeededCollection(
  current: Record<string, unknown>[],
  seeded: Record<string, unknown>[],
  uniqueField: string,
) {
  const currentKeys = new Set(current.map((item) => item[uniqueField]).filter(Boolean));
  return [...current, ...seeded.filter((item) => !currentKeys.has(item[uniqueField]))];
}

function buildFallbackDemoData() {
  const firstNames = ["Ahmed", "Sami", "Yassine", "Nour", "Mouna", "Leila", "Karim", "Amina", "Walid", "Salma"];
  const lastNames = ["Ben Ali", "Trabelsi", "Mansouri", "Jebali", "Karray", "Sassi", "Haddad", "Mejri", "Gharbi", "Ayari"];
  const addresses = ["Tunis", "Ariana", "Ben Arous", "La Marsa", "Sousse", "Monastir", "Sfax", "Nabeul", "Bizerte", "Hammamet"];
  const carModels = [
    ["Renault", "Clio", "Essence", "Manuelle", 95],
    ["Peugeot", "208", "Essence", "Automatique", 110],
    ["Volkswagen", "Polo", "Diesel", "Manuelle", 120],
    ["Hyundai", "i20", "Essence", "Automatique", 115],
    ["Kia", "Picanto", "Essence", "Manuelle", 80],
    ["Toyota", "Yaris", "Hybride", "Automatique", 130],
    ["Dacia", "Sandero", "Essence", "Manuelle", 85],
    ["Seat", "Ibiza", "Diesel", "Manuelle", 105],
    ["Fiat", "Tipo", "Diesel", "Manuelle", 125],
    ["Citroen", "C3", "Essence", "Automatique", 105],
  ] as const;

  const now = new Date();
  const clients: Record<string, unknown>[] = [];
  const cars: Record<string, unknown>[] = [];
  const reservations: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];
  const contracts: Record<string, unknown>[] = [];

  for (let index = 0; index < 100; index += 1) {
    const number = index + 1;
    const clientId = 900000 + number;
    const carId = 910000 + number;
    const reservationId = 920000 + number;
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
    const [brand, model, fuelType, transmission, dailyPrice] = carModels[index % carModels.length];
    const status = index % 4 === 0 ? "ONGOING" : index % 4 === 1 ? "RESERVED" : index % 4 === 2 ? "COMPLETED" : "EN_ATTENTE";
    const startDate = status === "ONGOING" ? toIsoDateOffset(now, -2) : toIsoDateOffset(now, index - 30);
    const duration = 2 + (index % 6);
    const endDate = toIsoDateOffset(new Date(startDate), duration);
    const createdAt = toIsoDateOffset(now, -number);

    clients.push({
      address: `${12 + index} Rue Massar, ${addresses[index % addresses.length]}`,
      archived: false,
      birthDate: `${1975 + (index % 25)}-0${(index % 9) + 1}-12`,
      birthPlace: addresses[(index + 3) % addresses.length],
      cin: `12${padNumber(number, 6)}`,
      cinIssueDate: `20${12 + (index % 10)}-0${(index % 9) + 1}-10`,
      cinIssuePlace: addresses[index % addresses.length],
      createdAt,
      drivingLicense: `DL${padNumber(number, 7)}`,
      drivingLicenseDate: `20${10 + (index % 10)}-0${(index % 9) + 1}-15`,
      fullName: `${firstName} ${lastName} ${padNumber(number)}`,
      id: clientId,
      isActive: index % 17 !== 0,
      nationality: "Tunisienne",
      passportNumber: `P${padNumber(number, 7)}`,
      phone: `+216 20 ${padNumber(number, 3)} ${padNumber(100 + number, 3)}`,
      updatedAt: createdAt,
    });

    cars.push({
      archived: false,
      brand,
      createdAt,
      dailyPrice,
      fuelType,
      id: carId,
      imageUrl: null,
      insuranceExpiryDate: toIsoDateOffset(now, 180 + index),
      mileage: 25000 + index * 730,
      model: `${model} ${2020 + (index % 5)}`,
      registrationNumber: `LM-${padNumber(number)}-TN`,
      status: status === "ONGOING" ? "RENTED" : "AVAILABLE",
      technicalVisitExpiryDate: toIsoDateOffset(now, 120 + index),
      transmission,
      updatedAt: createdAt,
      year: 2018 + (index % 7),
    });

    reservations.push({
      archived: false,
      carId,
      clientId,
      createdAt,
      dailyPrice,
      depositAmount: Math.round(Number(dailyPrice) * 1.5),
      endDate,
      id: reservationId,
      notes: `${fallbackSeedNotePrefix} Reservation demo ${padNumber(number)}`,
      pickupFuelLevel: status === "RESERVED" || status === "EN_ATTENTE" ? null : "Plein",
      pickupMileage: status === "RESERVED" || status === "EN_ATTENTE" ? null : 25000 + index * 730,
      returnFuelLevel: status === "COMPLETED" ? "Demi" : null,
      returnMileage: status === "COMPLETED" ? 25000 + index * 730 + duration * 140 : null,
      secondClientId: null,
      startDate,
      status,
      totalPrice: Number(dailyPrice) * duration,
      updatedAt: createdAt,
    });
  }

  return { cars, clients, contracts, payments, reservations };
}

function padNumber(value: number, size = 3) {
  return String(value).padStart(size, "0");
}

function storageKey(collection: CollectionCommand) {
  return `rentaldesk:${collection}`;
}

function buildFallbackAuthState() {
  return {
    authenticated: true,
    requiresSetup: false,
    user: {
      fullName: "Acces libre",
      id: 0,
      username: "guest",
    },
  };
}

function isProtectedCommand(command: string) {
  return !["get_auth_state", "register_user", "login_user", "logout_user"].includes(command);
}

function readAuthUsers(): FallbackAuthUser[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(authUsersStorageKey);
    if (!stored) {
      writeAuthUsers([devDefaultUser]);
      return [devDefaultUser];
    }
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as FallbackAuthUser[];
    }
    writeAuthUsers([devDefaultUser]);
    return [devDefaultUser];
  } catch {
    writeAuthUsers([devDefaultUser]);
    return [devDefaultUser];
  }
}

function writeAuthUsers(users: FallbackAuthUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(authUsersStorageKey, JSON.stringify(users));
}

function readAuthSession(): FallbackSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(authSessionStorageKey);
    if (!stored) return null;
    return JSON.parse(stored) as FallbackSessionUser;
  } catch {
    return null;
  }
}

function writeAuthSession(user: FallbackSessionUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(authSessionStorageKey, JSON.stringify(user));
}

function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(authSessionStorageKey);
}

function normalizeAuthUsername(value: string) {
  return value.trim().toLowerCase();
}

function toSessionUser(user: FallbackAuthUser): FallbackSessionUser {
  return {
    fullName: user.fullName,
    id: user.id,
    username: user.username,
  };
}

function seedFallbackAIData() {
  const now = new Date();
  const cars = readCollection<Record<string, unknown>>("cars");
  const clients = readCollection<Record<string, unknown>>("clients");
  const reservations = readCollection<Record<string, unknown>>("reservations");
  const payments = readCollection<Record<string, unknown>>("payments");

  const carSeeds = [
    ["Toyota", "Yaris", 105],
    ["Hyundai", "i20", 110],
    ["Renault", "Clio", 98],
    ["Peugeot", "208", 112],
    ["Kia", "Picanto", 94],
    ["Volkswagen", "Polo", 118],
    ["Seat", "Ibiza", 108],
    ["Dacia", "Sandero", 89],
  ] as const;
  const clientNames = [
    "Amine Ben Salem",
    "Sarra Gharbi",
    "Nour Trabelsi",
    "Walid Ben Hmida",
    "Meriem Khelifi",
    "Youssef Jaziri",
    "Ons Ben Yedder",
    "Karim Toumi",
    "Rania Sassi",
    "Hamza Mzoughi",
    "Aicha Ferjani",
    "Sami Kammoun",
    "Ines Rekik",
    "Mehdi Chatti",
    "Nesrine Ayadi",
    "Bilel Dhouib",
    "Imen Charfi",
    "Skander Achour",
    "Farah Abid",
    "Aziz Ben Amor",
    "Rim Hentati",
    "Houssem Bouraoui",
    "Nada Mhamdi",
    "Ghaith Sellami",
  ];

  const seedBase = Date.now();
  const createdCars = carSeeds.map(([brand, model, dailyPrice], index) => ({
    brand,
    createdAt: new Date().toISOString(),
    dailyPrice,
    fuelType: "ESSENCE",
    id: seedBase + index + 1,
    imageUrl: null,
    insuranceExpiryDate: toIsoDateOffset(now, 30 + index),
    mileage: 25000 + index * 7200,
    model,
    registrationNumber: `ML-${String(seedBase + index + 1).slice(-3)}-${200 + index}`,
    status: "AVAILABLE",
    technicalVisitExpiryDate: toIsoDateOffset(now, 45 + index),
    transmission: index % 2 === 0 ? "MANUAL" : "AUTOMATIC",
    updatedAt: new Date().toISOString(),
    year: 2020 + (index % 5),
  }));

  const createdClients = clientNames.map((fullName, index) => ({
    address: `Adresse ${index + 1} - Tunis`,
    birthDate: toIsoDateOffset(now, 9000 + index * 17),
    birthPlace: "Tunis",
    cin: `CIN${seedBase + index + 1}`,
    cinIssueDate: toIsoDateOffset(now, 2200 + index * 7),
    cinIssuePlace: "Tunis",
    createdAt: new Date().toISOString(),
    drivingLicense: `DL${seedBase + index + 1}`,
    drivingLicenseDate: toIsoDateOffset(now, 3650 + index * 11),
    fullName,
    id: seedBase + 500 + index + 1,
    isActive: true,
    nationality: "Tunisienne",
    passportNumber: null,
    phone: `55${String(seedBase + index + 100000).slice(-6)}`,
    updatedAt: new Date().toISOString(),
  }));

  const allCars = [...cars, ...createdCars];
  const allClients = [...clients, ...createdClients];

  const createdReservations: Record<string, unknown>[] = [];
  const createdPayments: Record<string, unknown>[] = [];

  for (let index = 0; index < 96; index += 1) {
    const durationDays = 2 + (index % 6);
    const startDaysAgo = 220 - index * 2;
    const startDate = toIsoDateTimeOffset(now, startDaysAgo, 8 + (index % 9));
    const endDate = toIsoDateTimeOffset(now, startDaysAgo - durationDays, 9 + ((index + 2) % 8));
    const dailyPrice = Number(createdCars[index % createdCars.length].dailyPrice) + (index % 4) * 6.5;
    const totalPrice = Number((dailyPrice * durationDays).toFixed(2));
    const depositAmount = index % 4 === 0 ? 500 : 300;
    const reservationId = seedBase + 1000 + index;

    createdReservations.push({
      carId: Number(createdCars[index % createdCars.length].id),
      clientId: Number(createdClients[index % createdClients.length].id),
      createdAt: new Date().toISOString(),
      dailyPrice,
      depositAmount,
      endDate,
      id: reservationId,
      notes: `Réservation test ML ${index + 1}`,
      pickupFuelLevel: "FULL",
      pickupMileage: 30000 + index * 180,
      returnFuelLevel: "HALF",
      returnMileage: 30220 + index * 180 + (index % 6) * 35,
      secondClientId: index % 5 === 0 ? Number(createdClients[(index + 3) % createdClients.length].id) : null,
      startDate,
      status: "COMPLETED",
      totalPrice,
      updatedAt: new Date().toISOString(),
    });

    createdPayments.push({
      amount: depositAmount,
      createdAt: new Date().toISOString(),
      id: seedBase + 2000 + createdPayments.length,
      method: "CASH",
      note: "Caution test ML",
      paymentDate: toIsoDateTimeOffset(now, startDaysAgo + 1, 10),
      reservationId,
      type: "DEPOSIT",
    });

    createdPayments.push({
      amount: totalPrice,
      createdAt: new Date().toISOString(),
      id: seedBase + 2000 + createdPayments.length,
      method: index % 3 === 0 ? "CARD" : index % 3 === 1 ? "CASH" : "TRANSFER",
      note: "Paiement location test ML",
      paymentDate: toIsoDateTimeOffset(now, startDaysAgo - durationDays + 1, 15),
      reservationId,
      type: "RENTAL_PAYMENT",
    });

    if (index % 7 === 0) {
      createdPayments.push({
        amount: index % 14 === 0 ? 250 : depositAmount,
        createdAt: new Date().toISOString(),
        id: seedBase + 2000 + createdPayments.length,
        method: "CASH",
        note: "Remboursement test ML",
        paymentDate: toIsoDateTimeOffset(now, startDaysAgo - durationDays + 2, 11),
        reservationId,
        type: "DEPOSIT_REFUND",
      });
    }
  }

  writeCollection("cars", allCars);
  writeCollection("clients", allClients);
  writeCollection("reservations", [...reservations, ...createdReservations]);
  writeCollection("payments", [...payments, ...createdPayments]);

  return {
    success: true,
    carsCreated: createdCars.length,
    clientsCreated: createdClients.length,
    reservationsCreated: createdReservations.length,
    paymentsCreated: createdPayments.length,
    message: `${createdCars.length} voitures, ${createdClients.length} clients, ${createdReservations.length} réservations et ${createdPayments.length} paiements de test ont été générés.`,
  };
}

function toIsoDateOffset(now: Date, daysAgo: number) {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function toIsoDateTimeOffset(now: Date, daysAgo: number, hour: number) {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function createFallbackContract(reservationId: number) {
  const existing = readCollection<Record<string, unknown>>("contracts").find(
    (contract) => contract.reservationId === reservationId,
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const contracts = readCollection<Record<string, unknown>>("contracts");
  const contract = {
    id: Date.now(),
    reservationId,
    contractNumber: `CNT-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(4, "0")}`,
    pdfPath: `contracts/CNT-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(4, "0")}.pdf`,
    status: "GENERATED",
    generatedAt: now,
    signedAt: null,
    createdAt: now,
  };
  writeCollection("contracts", [...contracts, contract]);
  return contract;
}

function validateFallbackReservation(data: Record<string, unknown>, excludedReservationId?: number) {
  const clientId = Number(data.clientId);
  const secondClientId = data.secondClientId == null ? null : Number(data.secondClientId);
  const carId = Number(data.carId);
  const startDate = String(data.startDate ?? "");
  const endDate = String(data.endDate ?? "");
  const dailyPrice = Number(data.dailyPrice);
  const depositAmount = Number(data.depositAmount);
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();

  if (clientId <= 0) throw new Error("Client obligatoire.");
  if (secondClientId && secondClientId === clientId) {
    throw new Error("Le deuxième conducteur doit être différent du client principal.");
  }
  if (carId <= 0) throw new Error("Voiture obligatoire.");
  if (!startDate) throw new Error("Date et heure de prise obligatoires.");
  if (!endDate) throw new Error("Date et heure de retour obligatoires.");
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime - startTime < 24 * 60 * 60 * 1000) {
    throw new Error("La durée minimale de location est de 24h.");
  }
  if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) throw new Error("Le prix/jour doit etre superieur a 0.");
  if (!Number.isFinite(depositAmount) || depositAmount < 0) throw new Error("La caution doit etre superieure ou egale a 0.");

  const car = readCollection<Record<string, unknown>>("cars").find((item) => item.id === carId && item.archived !== true);
  if (!car) throw new Error("Voiture introuvable.");
  if (["MAINTENANCE", "UNAVAILABLE"].includes(String(car.status))) {
    throw new Error("Cette voiture n'est pas disponible.");
  }

  const hasConflict = readCollection<Record<string, unknown>>("reservations").some((reservation) => {
    if (reservation.archived === true) return false;
    if (Number(reservation.id) === excludedReservationId) return false;
    if (Number(reservation.carId) !== carId) return false;
    if (!["EN_ATTENTE", "RESERVED", "ONGOING", "COMPLETED"].includes(String(reservation.status))) return false;

    const existingStart = new Date(normalizeLegacyDateTime(String(reservation.startDate ?? ""), "start")).getTime();
    const existingEnd = new Date(normalizeLegacyDateTime(String(reservation.endDate ?? ""), "end")).getTime();

    return existingStart < endTime && existingEnd >= startTime;
  });

  if (hasConflict) {
    throw new Error("Cette voiture est deja reservee sur cette periode.");
  }
}

function validateFallbackClient(data: Record<string, unknown>, currentClientId?: number) {
  const clients = readCollection<Record<string, unknown>>("clients");
  const uniqueFields = [
    ["phone", "Ce téléphone existe déjà."],
    ["cin", "Cette CIN existe déjà."],
    ["passportNumber", "Ce passeport existe déjà."],
    ["drivingLicense", "Ce numéro de permis existe déjà."],
  ] as const;

  for (const [field, message] of uniqueFields) {
    const value = String(data[field] ?? "").trim();
    if (!value) continue;
    const exists = clients.some((client) => Number(client.id) !== currentClientId && String(client[field] ?? "").trim() === value);
    if (exists) throw new Error(message);
  }
}

function validateFallbackPayment(data: Record<string, unknown>) {
  const reservationId = Number(data.reservationId);
  const amount = Number(data.amount);
  const type = String(data.type ?? "");

  if (reservationId <= 0) throw new Error("Réservation obligatoire.");
  if (!Number.isFinite(amount) || (type === "DEPOSIT_REFUND" ? amount < 0 : amount <= 0)) {
    throw new Error(type === "DEPOSIT_REFUND" ? "Le montant à rembourser doit être supérieur ou égal à 0." : "Le montant doit être supérieur à 0.");
  }

  const reservation = readCollection<Record<string, unknown>>("reservations").find(
    (item) => Number(item.id) === reservationId && item.archived !== true,
  );
  if (!reservation) throw new Error("Réservation introuvable.");

  const reservationPayments = readCollection<Record<string, unknown>>("payments").filter(
    (payment) => Number(payment.reservationId) === reservationId,
  );
  const rentalPaid = sumFallbackPayments(reservationPayments, "RENTAL_PAYMENT");
  const rentalRemaining = Math.max(0, Number(reservation.totalPrice ?? 0) - rentalPaid);
  const depositPaid = sumFallbackPayments(reservationPayments, "DEPOSIT");
  const depositRefunded = sumFallbackPayments(reservationPayments, "DEPOSIT_REFUND");
  const depositRefundDecided = reservationPayments.some((payment) => payment.type === "DEPOSIT_REFUND");
  const depositExpected = Number(reservation.depositAmount ?? 0);
  const refundableDeposit = depositPaid > 0 ? (depositExpected > 0 ? Math.min(depositPaid, depositExpected) : depositPaid) : 0;
  const depositAvailable = Math.max(0, refundableDeposit - depositRefunded);

  if (type === "RENTAL_PAYMENT" && amount > rentalRemaining) {
    throw new Error(`Le paiement location ne peut pas dépasser ${rentalRemaining} DT.`);
  }
  if (type === "RENTAL_PAYMENT" && rentalRemaining <= 0) {
    throw new Error("La location est déjà totalement payée.");
  }

  if (type === "DEPOSIT") {
    if (depositExpected <= 0) throw new Error("Aucune caution n'est prévue pour cette réservation.");
    if (depositPaid > 0) throw new Error("La caution est déjà encaissée pour cette réservation.");
    if (!amountsAreEqual(amount, depositExpected)) {
      throw new Error(`La caution doit être payée en une seule fois : ${depositExpected} DT.`);
    }
  }

  if (type === "DEPOSIT_REFUND") {
    if (depositRefundDecided) throw new Error("Le remboursement de caution est déjà enregistré pour cette réservation.");
    if (amount > depositAvailable) throw new Error(`Le remboursement ne peut pas dépasser ${depositAvailable} DT.`);
  }
}

function sumFallbackPayments(payments: Record<string, unknown>[], type: string) {
  return payments.filter((payment) => payment.type === type).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
}

function amountsAreEqual(first: number, second: number) {
  return Math.abs(first - second) < 0.001;
}

function normalizeLegacyDateTime(value: string, boundary: "start" | "end") {
  if (value.length > 10) return value;
  return boundary === "start" ? `${value}T00:00:00.000` : `${value}T23:59:59.999`;
}

function countDueSoon(items: Record<string, unknown>[], field: string) {
  const now = Date.now();
  const limit = now + 30 * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const value = item[field];
    if (typeof value !== "string" || !value) return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= now && time <= limit;
  }).length;
}
