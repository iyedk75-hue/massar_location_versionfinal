# RentalDesk - Application de gestion de location de voitures

RentalDesk est une application desktop de gestion d'agence de location de voitures. Elle regroupe la gestion du parc automobile, des clients, des réservations, des paiements, des contrats, des rapports financiers, des imports/exports Excel et un module de prévisions IA.

Le projet est construit avec React, TypeScript, Tailwind CSS et Tauri. Les données sont stockées localement dans une base SQLite, ce qui rend l'application utilisable en local sans serveur externe.

## Sommaire

- [Objectif du projet](#objectif-du-projet)
- [Fonctionnalités principales](#fonctionnalités-principales)
- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Installation](#installation)
- [Lancement du projet](#lancement-du-projet)
- [Scripts disponibles](#scripts-disponibles)
- [Base de données](#base-de-données)
- [Module IA](#module-ia)
- [Flux métier](#flux-métier)
- [Comptes et authentification](#comptes-et-authentification)
- [Import et export Excel](#import-et-export-excel)
- [Génération de contrats et rapports](#génération-de-contrats-et-rapports)
- [Bonnes pratiques de développement](#bonnes-pratiques-de-développement)
- [Dépannage](#dépannage)

## Objectif du projet

L'objectif de RentalDesk est de simplifier le travail quotidien d'une agence de location automobile:

- centraliser les informations des voitures et des clients;
- suivre les réservations sur un calendrier clair;
- vérifier la disponibilité des voitures avant validation;
- gérer les paiements, cautions et restes à payer;
- générer des contrats et des rapports;
- importer et exporter les données;
- analyser l'activité grâce à un module de prévision.

L'application vise un usage opérationnel: elle n'est pas seulement une interface de démonstration, mais un outil complet pour gérer des données réelles d'agence.

## Fonctionnalités principales

### Tableau de bord

Le tableau de bord donne une vue rapide sur l'activité:

- nombre total de voitures;
- voitures disponibles;
- voitures louées;
- revenus du mois;
- réservations en cours ou à venir;
- alertes importantes liées au parc.

### Gestion des voitures

La page Voitures permet de gérer toute la flotte:

- ajout d'une voiture;
- modification des informations;
- suppression individuelle ou groupée;
- sélection de plusieurs voitures dans la liste;
- recherche par marque, modèle ou immatriculation;
- filtre par statut;
- suivi du kilométrage;
- suivi assurance et visite technique;
- image du véhicule;
- statut: disponible, louée, maintenance, indisponible;
- gestion du retour voiture lorsqu'une location est en cours.

Les statuts des voitures sont liés aux réservations. Par exemple, lorsqu'une location démarre, la voiture passe en statut louée.

### Gestion des clients

La page Clients permet de gérer les informations client:

- ajout d'un client;
- modification;
- activation et désactivation;
- activation/désactivation groupée depuis la sélection;
- sélection de plusieurs clients;
- recherche par nom, téléphone, CIN, passeport ou permis;
- filtre par statut actif/inactif;
- historique des réservations;
- détection des clients fidèles;
- informations détaillées: CIN, passeport, permis, adresse, nationalité, date de naissance.

Un client désactivé reste visible dans l'historique, mais ne doit plus être utilisé comme nouveau client actif.

### Gestion des réservations

La page Réservations est le centre du workflow de location:

- création d'une réservation;
- modification d'une réservation existante;
- suppression;
- affichage dans un calendrier mensuel ou hebdomadaire;
- liste latérale des réservations;
- recherche client/voiture;
- filtre par statut;
- choix du client principal et d'un deuxième conducteur;
- choix de la voiture disponible;
- calcul automatique de la durée;
- calcul automatique du total;
- gestion de la caution;
- détection des conflits de disponibilité;
- statut: en attente, confirmée, en cours, terminée, annulée.

L'application vérifie qu'une voiture n'est pas déjà réservée sur la période choisie.

### Gestion des paiements

La page Paiements permet de suivre l'encaissement:

- paiements de location;
- caution;
- remboursement de caution;
- méthode de paiement;
- date de paiement;
- note associée;
- suivi du reste à payer;
- détails par réservation.

Les paiements sont liés aux réservations, ce qui permet de calculer les montants encaissés et les restes à payer.

### Contrats

Le module Contrats permet:

- de générer un contrat depuis une réservation;
- de consulter les contrats existants;
- de visualiser les détails du contrat;
- de préparer des documents PDF;
- d'utiliser les paramètres de l'agence dans les documents.

### Rapport CA

La page Rapport CA fournit une lecture financière:

- chiffre d'affaires prévu;
- montant encaissé;
- reste à payer;
- nombre de réservations;
- graphiques d'évolution;
- tableau quotidien;
- export possible selon les utilitaires du projet.

### Mouvement

La page Mouvement gère les imports/exports Excel:

- export des voitures en fichier `.xlsx`;
- export des clients en fichier `.xlsx`;
- téléchargement de templates vides;
- import de voitures;
- import de clients;
- validation stricte des colonnes;
- message d'erreur avec la ligne concernée en cas de problème.

### Module IA

Le module IA permet:

- de générer des données de test;
- d'entraîner des modèles;
- de lancer des prévisions;
- de prédire les tendances de revenus;
- d'estimer la demande future;
- d'identifier des segments clients;
- de proposer des recommandations.

Les scripts IA sont dans le dossier `ml`.

## Stack technique

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- React Hook Form
- Radix UI
- Lucide React
- Zustand
- XLSX
- pdf-lib

### Desktop/backend local

- Tauri 2
- Rust
- SQLite via `rusqlite`
- Commandes Tauri exposées au frontend
- Authentification locale avec hash PBKDF2

### Base de données

- SQLite
- Prisma comme description de schéma
- Migrations SQL dans `prisma/migrations`

### IA

- Python
- pandas
- numpy
- scikit-learn
- joblib

## Structure du projet

```text
rent_final/
├── ml/
│   ├── train_model.py          # Entraînement des modèles IA
│   ├── predict.py              # Génération des prédictions IA
│   └── requirements.txt        # Dépendances Python
├── prisma/
│   ├── schema.prisma           # Modèle de données
│   └── migrations/             # Migrations SQLite
├── public/
│   └── cursors/                # Assets publics
├── screenshots/                # Captures de l'application
├── src/
│   ├── app/                    # Router et layout
│   ├── components/             # Composants réutilisables
│   ├── hooks/                  # Hooks React
│   ├── lib/                    # Constantes et helpers
│   ├── pages/                  # Pages principales
│   ├── services/               # Appels aux commandes Tauri/fallback
│   ├── types/                  # Types TypeScript
│   └── utils/                  # Formatage, Excel, PDF, dates, validation
├── src-tauri/
│   ├── src/main.rs             # Backend Tauri/Rust
│   ├── tauri.conf.json         # Configuration desktop
│   └── Cargo.toml              # Dépendances Rust
├── package.json
├── vite.config.ts
└── README.md
```

## Installation

### Prérequis

Installez les outils suivants:

- Node.js récent;
- npm;
- Rust;
- Tauri CLI;
- Python 3.10+ si vous utilisez le module IA;
- SQLite si vous voulez inspecter la base manuellement.

### Installer les dépendances JavaScript

```bash
npm install
```

### Installer les dépendances Python du module IA

```bash
pip install -r ml/requirements.txt
```

Si plusieurs versions de Python sont installées, utilisez par exemple:

```bash
python -m pip install -r ml/requirements.txt
```

ou:

```bash
py -m pip install -r ml/requirements.txt
```

## Lancement du projet

### Lancer uniquement l'interface web

```bash
npm run dev
```

Cette commande lance Vite. Elle est utile pour développer l'interface rapidement.

### Lancer l'application desktop Tauri

```bash
npm run tauri:dev
```

Cette commande lance l'application desktop avec le backend Rust.

### Générer une version production web

```bash
npm run build
```

### Générer l'application desktop

```bash
npm run tauri:build
```

## Scripts disponibles

| Script | Description |
| --- | --- |
| `npm run dev` | Lance le serveur Vite |
| `npm run build` | Compile TypeScript et génère le build frontend |
| `npm run preview` | Prévisualise le build Vite |
| `npm run tauri` | Lance la CLI Tauri |
| `npm run tauri:dev` | Lance l'application desktop en développement |
| `npm run tauri:build` | Génère le build desktop |
| `npm run prisma:generate` | Génère le client Prisma |
| `npm run prisma:migrate` | Lance les migrations Prisma |
| `npm run prisma:studio` | Ouvre Prisma Studio |

## Base de données

L'application utilise SQLite en local.

Dans le backend Tauri, le chemin utilisé est:

```text
prisma/dev.db
```

La base est initialisée automatiquement au démarrage si elle n'existe pas encore.

### Tables principales

| Table | Rôle |
| --- | --- |
| `Car` | Voitures de l'agence |
| `Client` | Clients et conducteurs |
| `Reservation` | Réservations et périodes de location |
| `Payment` | Paiements, cautions, remboursements |
| `Contract` | Contrats générés |
| `User` | Utilisateurs locaux |

### Relations principales

- une voiture peut avoir plusieurs réservations;
- un client peut être client principal de plusieurs réservations;
- un client peut aussi être deuxième conducteur;
- une réservation appartient à une voiture;
- une réservation possède plusieurs paiements;
- une réservation peut avoir un contrat unique.

## Module IA

Le module IA se trouve dans le dossier `ml`.

### Dépendances

Les dépendances Python sont:

- pandas;
- numpy;
- scikit-learn;
- joblib.

Installation:

```bash
pip install -r ml/requirements.txt
```

### Entraîner les modèles manuellement

```bash
python ml/train_model.py --db prisma/dev.db --models ml/models --min-reservations 30
```

Paramètres:

- `--db`: chemin de la base SQLite;
- `--models`: dossier de sortie des modèles;
- `--min-reservations`: nombre minimal de réservations nécessaire pour entraîner un modèle fiable.

### Générer les prédictions manuellement

```bash
python ml/predict.py --db prisma/dev.db --models ml/models
```

### Sorties attendues

Le module IA peut produire:

- prévisions de revenus;
- prévisions de demande;
- estimation des réservations à venir;
- segmentation clients;
- recommandations opérationnelles.

Depuis l'application, ces actions sont disponibles dans la page IA.

## Flux métier

### Créer une réservation

1. Ouvrir la page Réservations.
2. Cliquer sur "Créer réservation".
3. Sélectionner le client principal.
4. Ajouter éventuellement un deuxième conducteur.
5. Choisir la voiture.
6. Définir la date et l'heure de départ.
7. Définir la date et l'heure de retour.
8. Vérifier le prix, la caution et le total.
9. Valider la réservation.

### Modifier une réservation

1. Ouvrir les détails d'une réservation.
2. Cliquer sur "Modifier".
3. Ajuster les informations.
4. Enregistrer.

Une location en cours doit être clôturée avant modification.

### Démarrer une location

1. Ouvrir une réservation en attente ou confirmée.
2. Cliquer sur "Démarrer".
3. La réservation passe en cours.
4. La voiture associée passe en statut louée.

### Terminer une location

1. Ouvrir la page Voitures.
2. Identifier la voiture louée.
3. Cliquer sur "Retour".
4. Saisir le kilométrage retour et le niveau carburant.
5. Confirmer.
6. La réservation passe en terminée.
7. La voiture redevient disponible.

### Encaisser un paiement

1. Ouvrir la page Paiements.
2. Ajouter un paiement.
3. Sélectionner la réservation.
4. Choisir le type: location, caution ou remboursement.
5. Saisir le montant et la méthode.
6. Valider.

## Comptes et authentification

L'application possède une authentification locale.

Au premier démarrage, un utilisateur de développement peut être créé automatiquement si aucun compte n'existe:

```text
Nom utilisateur: admin
Mot de passe: admin12345
```

Les mots de passe sont stockés sous forme de hash avec sel.

Pour un usage réel, il est conseillé de créer un vrai compte administrateur et de remplacer le compte de développement.

## Import et export Excel

La page Mouvement permet d'importer et d'exporter les données.

### Export

Vous pouvez exporter:

- les voitures;
- les clients.

Les fichiers sont générés au format `.xlsx`.

### Import

L'import repose sur un template strict.

Pour éviter les erreurs:

1. Télécharger le template vide depuis l'application.
2. Remplir les colonnes demandées.
3. Respecter les formats de dates.
4. Importer le fichier.

Si une ligne est invalide, l'import s'arrête et affiche un message indiquant le problème.

## Génération de contrats et rapports

### Contrats

Les contrats sont liés aux réservations.

Un contrat contient notamment:

- numéro de contrat;
- client;
- voiture;
- période de location;
- prix total;
- caution;
- kilométrage;
- carburant;
- statut.

### Rapports

Les rapports financiers affichent:

- chiffre d'affaires;
- encaissements;
- restes à payer;
- nombre de réservations;
- évolution par période.

## Bonnes pratiques de développement

### Avant de modifier une fonctionnalité

- Identifier la page dans `src/pages`.
- Vérifier le service associé dans `src/services`.
- Vérifier les types dans `src/types`.
- Si la donnée vient de SQLite, vérifier aussi `src-tauri/src/main.rs`.

### Ajouter un nouveau champ

Pour ajouter un champ persistant:

1. Modifier `prisma/schema.prisma`.
2. Ajouter une migration SQL dans `prisma/migrations`.
3. Modifier les types TypeScript dans `src/types`.
4. Modifier le backend Tauri dans `src-tauri/src/main.rs`.
5. Modifier le formulaire concerné.
6. Modifier l'affichage dans les pages.

### Vérifier le projet

```bash
npm run build
```

Pour l'application desktop:

```bash
npm run tauri:build
```

## Dépannage

### Le build échoue sur Vite ou esbuild

Essayez:

```bash
npm install
npm run build
```

Sur certains environnements Windows, l'exécution d'esbuild peut être bloquée par des permissions système ou antivirus.

### Le module IA ne trouve pas Python

Dans Paramètres, renseignez le chemin Python:

```text
C:/Python311/python.exe
```

ou utilisez simplement:

```text
python
```

selon votre configuration.

### Les prédictions IA ne se lancent pas

Vérifiez:

- que les dépendances Python sont installées;
- que la base contient assez de réservations;
- que le chemin des modèles est correct;
- que l'entraînement a été lancé au moins une fois.

### La base de données semble vide

Vérifiez l'existence du fichier:

```text
prisma/dev.db
```

Puis relancez:

```bash
npm run tauri:dev
```

## Résumé

RentalDesk est une application desktop complète pour une agence de location de voitures. Elle couvre les besoins essentiels: parc automobile, clients, réservations, paiements, contrats, rapports, imports/exports et prévisions IA.

Le projet combine une interface moderne React/TypeScript avec un backend local Tauri/Rust et une base SQLite, ce qui le rend pratique pour un usage local, rapide et autonome.
