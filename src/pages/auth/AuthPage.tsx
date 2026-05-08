import { Car } from "lucide-react";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";

type AuthPageProps = {
  requiresSetup: boolean;
};

type LoginFormValues = {
  password: string;
  username: string;
};

type SetupFormValues = {
  confirmPassword: string;
  fullName: string;
  password: string;
  username: string;
};

const brandName = "Massar Location";

export function AuthPage({ requiresSetup }: AuthPageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const chainHitRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [lit, setLit] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const chain = chainRef.current;
    const chainHit = chainHitRef.current;
    if (!stage || !chain || !chainHit) return;
    const stageEl = stage;
    const chainEl = chain;
    const chainHitEl = chainHit;

    let angle = 0;
    let angleVel = 0;
    let stretch = 1;
    let stretchVel = 1;
    let dragging = false;
    let dragOriginX = 0;
    let dragOriginY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pulledThreshold = false;
    let pendingClick = false;
    let clickFireStretch = 1;
    let lastT = 0;
    let frame = 0;

    const restLenPx = 60;
    const maxStretch = 1.9;
    const activatePullPx = 28;
    const springK = 240;
    const springDamp = 12;
    const pendK = 180;
    const pendDamp = 1.1;

    const toggle = () => {
      setLit((current) => {
        const next = !current;
        if (next) {
          setFlash(true);
          window.setTimeout(() => setFlash(false), 1200);
          window.setTimeout(() => firstInputRef.current?.focus({ preventScroll: true }), 1100);
        }
        return next;
      });
    };

    function getPivot() {
      const r = chainEl.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top };
    }

    function applyTransform() {
      chainEl.style.transform = `rotate(${angle.toFixed(2)}deg) scaleY(${stretch.toFixed(3)})`;
    }

    function getPoint(event: MouseEvent | TouchEvent) {
      return "touches" in event ? event.touches[0] : event;
    }

    function pullStart(event: MouseEvent | TouchEvent) {
      if (event.cancelable) event.preventDefault();
      const point = getPoint(event);
      if (!point) return;

      dragging = true;
      pulledThreshold = false;
      pendingClick = false;
      pointerX = point.clientX;
      pointerY = point.clientY;
      const pivot = getPivot();
      dragOriginX = pivot.x;
      dragOriginY = pivot.y;
      chainEl.classList.add("grabbing");
    }

    function pullMove(event: MouseEvent | TouchEvent) {
      if (!dragging) return;
      const point = getPoint(event);
      if (!point) return;
      pointerX = point.clientX;
      pointerY = point.clientY;
      if (event.cancelable && "touches" in event) event.preventDefault();
    }

    function pullEnd() {
      if (!dragging) return;
      dragging = false;
      chainEl.classList.remove("grabbing");

      if (pulledThreshold) {
        pendingClick = true;
        clickFireStretch = 1 + (activatePullPx * 0.35) / restLenPx;
      } else {
        stretchVel += 14;
        angleVel += (Math.random() - 0.5) * 30;
        toggle();
      }
      stretchVel -= (stretch - 1) * 8;
    }

    function tick(t: number) {
      if (!lastT) lastT = t;
      let dt = (t - lastT) / 1000;
      lastT = t;
      if (dt > 0.05) dt = 0.05;

      if (dragging) {
        const dx = pointerX - dragOriginX;
        const dy = pointerY - dragOriginY;
        const targetAngle =
          dy <= 0
            ? dx >= 0
              ? 85
              : -85
            : Math.max(-85, Math.min(85, (Math.atan2(dx, dy) * 180) / Math.PI));
        const dist = Math.sqrt(dx * dx + dy * dy);
        const targetStretch = Math.max(0.95, Math.min(maxStretch, dist / restLenPx));

        angle += (targetAngle - angle) * Math.min(1, dt * 38);
        stretch += (targetStretch - stretch) * Math.min(1, dt * 35);
        angleVel = (targetAngle - angle) * 8;
        stretchVel *= 0.5;

        const pulledPx = (stretch - 1) * restLenPx;
        if (!pulledThreshold && pulledPx > activatePullPx) {
          pulledThreshold = true;
          stretchVel -= 1.5;
        }
      } else {
        const stretchF = -springK * (stretch - 1) - springDamp * stretchVel;
        stretchVel += stretchF * dt;
        stretch += stretchVel * dt;

        const angleRad = (angle * Math.PI) / 180;
        const pendF = -pendK * Math.sin(angleRad) - pendDamp * angleVel;
        angleVel += pendF * dt;
        angle += angleVel * dt;

        if (pendingClick && stretchVel < 0 && stretch <= clickFireStretch) {
          pendingClick = false;
          toggle();
          stretchVel -= 4;
          angleVel += (Math.random() - 0.5) * 6;
        }

        if (Math.abs(stretch - 1) < 0.001 && Math.abs(stretchVel) < 0.01) {
          stretch = 1;
          stretchVel = 0;
        }
        if (Math.abs(angle) < 0.05 && Math.abs(angleVel) < 0.1) {
          angle = 0;
          angleVel = 0;
        }
      }

      applyTransform();
      frame = requestAnimationFrame(tick);
    }

    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && document.activeElement === document.body) {
        event.preventDefault();
        stretchVel += 18;
        angleVel += (Math.random() - 0.5) * 40;
        toggle();
      }
    };

    const teaserTimer = window.setInterval(() => {
      if (stageEl.classList.contains("lit") || dragging) return;
      angleVel += 25;
    }, 9000);

    frame = requestAnimationFrame(tick);
    chainHitEl.addEventListener("mousedown", pullStart);
    chainHitEl.addEventListener("touchstart", pullStart, { passive: false });
    window.addEventListener("mousemove", pullMove, { passive: false });
    window.addEventListener("touchmove", pullMove, { passive: false });
    window.addEventListener("mouseup", pullEnd);
    window.addEventListener("touchend", pullEnd);
    window.addEventListener("mouseleave", pullEnd);
    window.addEventListener("keydown", keyDown);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(teaserTimer);
      chainHitEl.removeEventListener("mousedown", pullStart);
      chainHitEl.removeEventListener("touchstart", pullStart);
      window.removeEventListener("mousemove", pullMove);
      window.removeEventListener("touchmove", pullMove);
      window.removeEventListener("mouseup", pullEnd);
      window.removeEventListener("touchend", pullEnd);
      window.removeEventListener("mouseleave", pullEnd);
      window.removeEventListener("keydown", keyDown);
    };
  }, []);

  return (
    <div className="massar-auth-shell">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Inter:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <AuthPageStyles />

      <div className={`stage ${lit ? "lit" : ""}`} ref={stageRef}>
        <div className="wordmark">
          <BrandGlyph className="wm-logo" />
          <span>Massar</span>
          <span className="dot" />
          <span>Location</span>
        </div>

        <div className="scene" data-screen-label={requiresSetup ? "01 Setup" : "01 Login"}>
          <div className="lamp-area">
            <div className="glow" />
            <div className="lamp">
              <div className="shade" />
              <div className="shade-lip" />
              <div className="neck" />
              <div className="collar" />
              <div className="chain" ref={chainRef}>
                <div className="chain-hit" ref={chainHitRef} />
                <div className="bead" />
              </div>
              <div className="pull-hint">Tirez pour commencer</div>
              <div className="base" />
            </div>
          </div>

          <div className="card-area">
            <div className="off-cue">
              <div className="inner">
                La pièce est sombre.
                <span className="arrow">Tirez la chaînette</span>
              </div>
            </div>
            {requiresSetup ? <SetupCard firstInputRef={firstInputRef} lit={lit} /> : <LoginCard firstInputRef={firstInputRef} lit={lit} />}
          </div>
        </div>

        <div className="corner">MASSAR LOCATION - EST. 2026 - CASABLANCA</div>
      </div>

      <div className={`welcome-flash ${flash ? "go" : ""}`} />
    </div>
  );
}

function LoginCard({ firstInputRef, lit }: { firstInputRef: MutableRefObject<HTMLInputElement | null>; lit: boolean }) {
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState("");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginFormValues>({
    defaultValues: {
      password: "",
      username: "",
    },
  });

  const usernameField = register("username", {
    validate: (value) => value.trim().length > 0 || "Le nom d'utilisateur est obligatoire.",
  });

  async function submit(values: LoginFormValues) {
    if (!lit) return;
    try {
      setSubmitError("");
      await login(values);
    } catch (caught) {
      setSubmitError(getErrorMessage(caught));
    }
  }

  return (
    <form className="card" autoComplete="off" onSubmit={handleSubmit(submit)}>
      <div className="brand-mark">
        <BrandGlyph className="brand-glyph-img" />
        <span className="brand-text">{brandName}</span>
      </div>
      <h1>Bienvenue</h1>

      <div className="field">
        <label htmlFor="username">Identifiant</label>
        <input
          id="username"
          autoComplete="username"
          placeholder="admin"
          {...usernameField}
          ref={(element) => {
            usernameField.ref(element);
            firstInputRef.current = element;
          }}
        />
        {errors.username?.message && <p className="field-error">{errors.username.message}</p>}
      </div>

      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          autoComplete="current-password"
          placeholder="Votre mot de passe"
          type="password"
          {...register("password", {
            validate: (value) => value.length > 0 || "Le mot de passe est obligatoire.",
          })}
        />
        {errors.password?.message && <p className="field-error">{errors.password.message}</p>}
      </div>

      <div className="row">
        <label className="check">
          <input defaultChecked type="checkbox" />
          <span className="box" />
          <span>Rester connecté</span>
        </label>
        <button className="link-button" type="button">
          Oublié ?
        </button>
      </div>

      {submitError && <p className="submit-error">{submitError}</p>}

      <button className="btn" disabled={isSubmitting || !lit} type="submit">
        {isSubmitting ? "Connexion..." : "Se connecter"}
      </button>

      <div className="footer">Compte local sécurisé</div>
    </form>
  );
}

function SetupCard({ firstInputRef, lit }: { firstInputRef: MutableRefObject<HTMLInputElement | null>; lit: boolean }) {
  const { register: registerAccount } = useAuth();
  const [submitError, setSubmitError] = useState("");
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
  } = useForm<SetupFormValues>({
    defaultValues: {
      confirmPassword: "",
      fullName: "",
      password: "",
      username: "",
    },
  });

  const fullNameField = register("fullName", {
    validate: (value) => value.trim().length >= 2 || "Le nom complet doit contenir au moins 2 caractères.",
  });

  async function submit(values: SetupFormValues) {
    if (!lit) return;
    try {
      setSubmitError("");
      await registerAccount({
        fullName: values.fullName.trim(),
        password: values.password,
        username: values.username.trim(),
      });
    } catch (caught) {
      setSubmitError(getErrorMessage(caught));
    }
  }

  return (
    <form className="card setup-card" autoComplete="off" onSubmit={handleSubmit(submit)}>
      <div className="brand-mark">
        <BrandGlyph className="brand-glyph-img" />
        <span className="brand-text">{brandName}</span>
      </div>
      <h1>Configuration</h1>

      <div className="field compact">
        <label htmlFor="fullName">Nom complet</label>
        <input
          id="fullName"
          autoComplete="name"
          placeholder="Ahmed Mahjoub"
          {...fullNameField}
          ref={(element) => {
            fullNameField.ref(element);
            firstInputRef.current = element;
          }}
        />
        {errors.fullName?.message && <p className="field-error">{errors.fullName.message}</p>}
      </div>

      <div className="field compact">
        <label htmlFor="setupUsername">Identifiant</label>
        <input
          id="setupUsername"
          autoComplete="username"
          placeholder="admin"
          {...register("username", {
            validate: (value) => value.trim().length >= 3 || "Le nom d'utilisateur doit contenir au moins 3 caractères.",
          })}
        />
        {errors.username?.message && <p className="field-error">{errors.username.message}</p>}
      </div>

      <div className="field compact">
        <label htmlFor="setupPassword">Mot de passe</label>
        <input
          id="setupPassword"
          autoComplete="new-password"
          placeholder="Au moins 8 caractères"
          type="password"
          {...register("password", {
            validate: (value) => value.length >= 8 || "Le mot de passe doit contenir au moins 8 caractères.",
          })}
        />
        {errors.password?.message && <p className="field-error">{errors.password.message}</p>}
      </div>

      <div className="field compact">
        <label htmlFor="confirmPassword">Confirmation</label>
        <input
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Répétez le mot de passe"
          type="password"
          {...register("confirmPassword", {
            validate: (value) => value === getValues("password") || "Les mots de passe ne correspondent pas.",
          })}
        />
        {errors.confirmPassword?.message && <p className="field-error">{errors.confirmPassword.message}</p>}
      </div>

      {submitError && <p className="submit-error">{submitError}</p>}

      <button className="btn" disabled={isSubmitting || !lit} type="submit">
        {isSubmitting ? "Création..." : "Créer le compte"}
      </button>
    </form>
  );
}

function BrandGlyph({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`brand-glyph ${className ?? ""}`}>
      <Car strokeWidth={2.4} />
    </span>
  );
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

function AuthPageStyles() {
  return (
    <style>{`
      .massar-auth-shell {
        --bg-0: oklch(0.14 0.04 250);
        --bg-1: oklch(0.18 0.05 250);
        --bg-2: oklch(0.24 0.07 250);
        --ink: oklch(0.98 0.005 240);
        --ink-soft: oklch(0.82 0.015 240);
        --ink-mute: oklch(0.58 0.020 240);
        --blue-deep: oklch(0.55 0.18 245);
        --blue-bright: oklch(0.82 0.14 235);
        --warm: oklch(0.96 0.04 230);
        min-height: 100vh;
        font-family: "Inter", Helvetica, Arial, sans-serif;
        color: var(--ink);
        overflow: hidden;
        -webkit-font-smoothing: antialiased;
      }

      .massar-auth-shell * {
        box-sizing: border-box;
      }

      .stage {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: radial-gradient(1200px 900px at 30% 55%, var(--bg-2) 0%, var(--bg-1) 35%, var(--bg-0) 70%);
        transition: background 1.4s ease;
      }

      .stage.lit {
        background: radial-gradient(900px 700px at 28% 45%, oklch(0.45 0.14 235) 0%, oklch(0.30 0.10 240) 30%, var(--bg-1) 55%, var(--bg-0) 80%);
      }

      .stage::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image: radial-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px);
        background-size: 3px 3px;
        mix-blend-mode: overlay;
        opacity: 0.6;
      }

      .wordmark {
        position: absolute;
        top: 36px;
        left: 50%;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 14px;
        transform: translateX(-50%);
        font-family: "Fraunces", Georgia, serif;
        font-size: 22px;
        font-weight: 300;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        white-space: nowrap;
        color: var(--ink-mute);
        transition: color 1.2s ease, letter-spacing 1.2s ease;
      }

      .wm-logo {
        width: 28px;
        height: 32px;
        border-radius: 8px;
        font-size: 15px;
        filter: saturate(0.6) brightness(0.75);
        transition: filter 1.2s ease, transform 1.2s ease;
      }

      .stage.lit .wm-logo {
        filter: saturate(1.1) brightness(1.05) drop-shadow(0 0 10px oklch(0.85 0.14 235 / 0.6));
        transform: translateY(-1px);
      }

      .stage.lit .wordmark {
        color: var(--warm);
        letter-spacing: 0.22em;
      }

      .wordmark .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ink-mute);
        transition: background 1.2s ease, box-shadow 1.2s ease;
      }

      .stage.lit .wordmark .dot {
        background: var(--blue-bright);
        box-shadow: 0 0 12px var(--blue-bright);
      }

      .scene {
        position: relative;
        z-index: 1;
        width: min(1100px, 92vw);
        height: min(640px, 78vh);
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
      }

      .lamp-area,
      .card-area {
        position: relative;
        height: 100%;
        display: grid;
        place-items: center;
      }

      .glow {
        position: absolute;
        width: 800px;
        height: 800px;
        left: 50%;
        top: 42%;
        transform: translate(-50%, -50%) scale(0.3);
        border-radius: 50%;
        background: radial-gradient(circle, oklch(0.96 0.10 235 / 0.55) 0%, oklch(0.85 0.14 235 / 0.30) 18%, oklch(0.70 0.16 240 / 0.10) 38%, transparent 65%);
        opacity: 0;
        pointer-events: none;
        transition: opacity 1.2s ease, transform 1.4s cubic-bezier(.2,.8,.2,1);
        filter: blur(8px);
      }

      .stage.lit .glow {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
        animation: auth-breathe 6s ease-in-out infinite 1.5s;
      }

      @keyframes auth-breathe {
        0%, 100% { opacity: 0.92; }
        50% { opacity: 1; }
      }

      .lamp {
        position: relative;
        width: 280px;
        height: 360px;
        z-index: 2;
      }

      .shade {
        position: absolute;
        top: 40px;
        left: 50%;
        width: 220px;
        height: 110px;
        transform: translateX(-50%);
        border-radius: 220px 220px 14px 14px / 130px 130px 14px 14px;
        background: linear-gradient(180deg, oklch(0.42 0.012 70) 0%, oklch(0.32 0.010 70) 100%);
        box-shadow: inset 0 -10px 20px rgba(0,0,0,0.4), inset 0 4px 0 rgba(255,255,255,0.04);
        transition: background 1.2s ease, box-shadow 1.2s ease;
      }

      .stage.lit .shade {
        background: radial-gradient(ellipse at 50% 90%, oklch(0.99 0.04 230) 0%, oklch(0.94 0.10 235) 25%, oklch(0.80 0.14 235) 60%, oklch(0.55 0.10 240) 100%);
        box-shadow: inset 0 -14px 28px oklch(0.85 0.14 235 / 0.6), inset 0 4px 0 rgba(255,255,255,0.18), 0 0 60px oklch(0.85 0.14 235 / 0.45), 0 0 120px oklch(0.85 0.14 235 / 0.28);
      }

      .shade-lip {
        position: absolute;
        top: 145px;
        left: 50%;
        width: 230px;
        height: 8px;
        transform: translateX(-50%);
        border-radius: 4px;
        background: linear-gradient(180deg, oklch(0.36 0.010 70), oklch(0.26 0.010 70));
        transition: background 1.2s ease, box-shadow 1.2s ease;
      }

      .stage.lit .shade-lip {
        background: linear-gradient(180deg, oklch(0.80 0.12 235), oklch(0.62 0.14 240));
        box-shadow: 0 0 20px oklch(0.85 0.14 235 / 0.55);
      }

      .neck {
        position: absolute;
        top: 153px;
        left: 50%;
        width: 6px;
        height: 175px;
        transform: translateX(-50%);
        border-radius: 3px 3px 0 0;
        background: linear-gradient(90deg, oklch(0.30 0.008 70) 0%, oklch(0.55 0.012 75) 45%, oklch(0.55 0.012 75) 55%, oklch(0.30 0.008 70) 100%);
      }

      .collar {
        position: absolute;
        top: 322px;
        left: 50%;
        z-index: 1;
        width: 22px;
        height: 10px;
        transform: translateX(-50%);
        border-radius: 4px 4px 2px 2px;
        background: linear-gradient(180deg, oklch(0.55 0.012 75) 0%, oklch(0.42 0.010 70) 60%, oklch(0.30 0.008 70) 100%);
        box-shadow: 0 2px 4px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08);
      }

      .base {
        position: absolute;
        bottom: 14px;
        left: 50%;
        width: 150px;
        height: 18px;
        transform: translateX(-50%);
        border-radius: 50% / 60% 60% 40% 40%;
        background: radial-gradient(ellipse at 50% 20%, oklch(0.62 0.012 75) 0%, oklch(0.45 0.010 70) 30%, oklch(0.28 0.008 70) 75%, oklch(0.20 0.008 70) 100%);
        box-shadow: 0 6px 14px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.10), inset 0 -3px 6px rgba(0,0,0,0.4);
      }

      .base::before {
        content: "";
        position: absolute;
        bottom: -6px;
        left: 50%;
        width: 150px;
        height: 6px;
        transform: translateX(-50%);
        border-radius: 50%;
        background: rgba(0,0,0,0.5);
        filter: blur(6px);
      }

      .chain {
        position: absolute;
        top: 158px;
        left: calc(50% + 78px);
        width: 2px;
        height: 60px;
        transform: rotate(0deg) scaleY(1);
        transform-origin: top center;
        cursor: grab;
        background: repeating-linear-gradient(180deg, oklch(0.55 0.010 70) 0 4px, transparent 4px 6px);
        will-change: transform;
      }

      .chain.grabbing {
        cursor: grabbing;
      }

      .chain-hit {
        position: absolute;
        top: -10px;
        left: 50%;
        z-index: 5;
        width: 36px;
        height: 90px;
        transform: translateX(-50%);
        cursor: grab;
      }

      .chain-hit:active {
        cursor: grabbing;
      }

      .bead {
        position: absolute;
        bottom: -8px;
        left: 50%;
        width: 14px;
        height: 14px;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, oklch(0.82 0.14 60), oklch(0.62 0.14 55) 55%, oklch(0.40 0.10 45) 100%);
        box-shadow: 0 3px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.25);
      }

      .pull-hint {
        position: absolute;
        top: 235px;
        left: calc(50% + 100px);
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-mute);
        white-space: nowrap;
        pointer-events: none;
        opacity: 0.7;
        transition: opacity 0.6s ease;
      }

      .stage.lit .pull-hint {
        opacity: 0;
      }

      .pull-hint::before {
        content: "";
        position: absolute;
        left: -16px;
        top: 50%;
        width: 12px;
        height: 1px;
        background: var(--ink-mute);
      }

      .card {
        position: relative;
        width: 380px;
        max-height: min(620px, 82vh);
        overflow: auto;
        padding: 44px 38px 38px;
        border: 1px solid oklch(0.55 0.010 80 / 0.10);
        border-radius: 20px;
        background: oklch(0.22 0.008 70 / 0.55);
        box-shadow: 0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
        opacity: 0;
        pointer-events: none;
        transform: translateY(20px) scale(0.98);
        transition: opacity 1s ease 0.4s, transform 1s cubic-bezier(.2,.8,.2,1) 0.4s, border-color 1.2s ease, box-shadow 1.2s ease;
        backdrop-filter: blur(24px) saturate(1.1);
        -webkit-backdrop-filter: blur(24px) saturate(1.1);
      }

      .stage.lit .card {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
        border-color: oklch(0.85 0.14 85 / 0.18);
        box-shadow: 0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 40px oklch(0.85 0.14 85 / 0.06);
      }

      .setup-card {
        padding-top: 34px;
        padding-bottom: 32px;
      }

      .card h1 {
        margin: 0 0 28px;
        font-family: "Fraunces", Georgia, serif;
        font-size: 30px;
        font-weight: 400;
        line-height: 1.1;
        text-align: center;
        letter-spacing: 0;
        color: var(--ink);
      }

      .brand-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin: -8px 0 18px;
      }

      .brand-glyph {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        background: linear-gradient(135deg, var(--blue-deep), var(--blue-bright));
        color: #fff;
        box-shadow: 0 4px 14px oklch(0.55 0.18 245 / 0.5), inset 0 1px 0 rgba(255,255,255,0.3);
      }

      .brand-glyph svg {
        width: 62%;
        height: 62%;
      }

      .brand-glyph-img {
        width: 34px;
        height: 38px;
        border-radius: 10px;
        filter: drop-shadow(0 4px 10px oklch(0.55 0.18 245 / 0.55));
      }

      .brand-text {
        font: 500 11px/1 "Inter", sans-serif;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--ink-soft);
      }

      .field {
        margin-bottom: 18px;
      }

      .field.compact {
        margin-bottom: 13px;
      }

      .field label {
        display: block;
        margin-bottom: 8px;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink-mute);
      }

      .field input {
        width: 100%;
        padding: 13px 16px;
        border: 1px solid oklch(0.55 0.010 80 / 0.18);
        border-radius: 999px;
        outline: none;
        background: oklch(0.18 0.008 70 / 0.6);
        color: var(--ink);
        font: 14px/1.4 "Inter", sans-serif;
        transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
      }

      .field input::placeholder {
        color: var(--ink-mute);
      }

      .field input:focus {
        border-color: oklch(0.85 0.14 85 / 0.5);
        background: oklch(0.20 0.010 70 / 0.7);
        box-shadow: 0 0 0 4px oklch(0.85 0.14 85 / 0.08);
      }

      .field-error {
        margin: 6px 0 0;
        color: oklch(0.74 0.18 30);
        font-size: 12px;
        line-height: 1.4;
      }

      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin: 6px 0 22px;
        font-size: 12px;
      }

      .check {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--ink-soft);
        cursor: pointer;
        user-select: none;
      }

      .check input {
        display: none;
      }

      .check .box {
        width: 14px;
        height: 14px;
        display: grid;
        place-items: center;
        border: 1px solid oklch(0.55 0.010 80 / 0.4);
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .check input:checked + .box {
        border-color: var(--blue-bright);
        background: var(--blue-bright);
      }

      .check input:checked + .box::after {
        content: "";
        width: 6px;
        height: 3px;
        border-left: 1.5px solid #1a1a1a;
        border-bottom: 1.5px solid #1a1a1a;
        transform: rotate(-45deg) translate(0, -1px);
      }

      .link-button {
        border: 0;
        padding: 0;
        background: transparent;
        color: var(--ink-mute);
        font: inherit;
        transition: color 0.2s ease;
      }

      .link-button:hover {
        color: var(--blue-bright);
      }

      .submit-error {
        margin: 0 0 14px;
        padding: 10px 12px;
        border: 1px solid oklch(0.62 0.20 30 / 0.35);
        border-radius: 14px;
        background: oklch(0.30 0.08 30 / 0.28);
        color: oklch(0.84 0.12 30);
        font-size: 13px;
        line-height: 1.45;
      }

      .btn {
        position: relative;
        width: 100%;
        overflow: hidden;
        padding: 14px 16px;
        border: none;
        border-radius: 999px;
        background: linear-gradient(135deg, oklch(0.62 0.18 245) 0%, oklch(0.78 0.16 235) 35%, oklch(0.55 0.20 248) 70%, oklch(0.72 0.17 240) 100%);
        color: oklch(0.99 0.005 240);
        font: 600 13px/1 "Inter", sans-serif;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 8px 24px oklch(0.55 0.18 245 / 0.45), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.18);
        transition: transform 0.15s ease, box-shadow 0.25s ease, filter 0.25s ease;
      }

      .btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 12px 30px oklch(0.55 0.18 245 / 0.55), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.18);
      }

      .btn:active:not(:disabled) {
        transform: translateY(0);
      }

      .btn::before {
        content: "";
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
        transition: left 0.6s ease;
      }

      .btn:hover::before {
        left: 100%;
      }

      .btn:disabled {
        cursor: not-allowed;
        filter: brightness(0.85) saturate(0.7);
      }

      .footer {
        margin-top: 22px;
        text-align: center;
        font-size: 12px;
        color: var(--ink-mute);
      }

      .off-cue {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        text-align: center;
        pointer-events: none;
        transition: opacity 0.6s ease;
      }

      .stage.lit .off-cue {
        opacity: 0;
      }

      .off-cue .inner {
        max-width: 280px;
        color: var(--ink-mute);
        font-family: "Fraunces", Georgia, serif;
        font-size: 15px;
        font-style: italic;
        line-height: 1.5;
      }

      .off-cue .arrow {
        display: block;
        margin-top: 10px;
        color: oklch(0.45 0.012 70);
        font-family: "Inter", sans-serif;
        font-size: 10px;
        font-style: normal;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }

      .welcome-flash {
        position: fixed;
        inset: 0;
        z-index: 100;
        pointer-events: none;
        background: radial-gradient(circle at 30% 50%, oklch(0.92 0.12 235 / 0.45), transparent 50%);
        opacity: 0;
      }

      .welcome-flash.go {
        animation: auth-flash 1.2s ease-out forwards;
      }

      @keyframes auth-flash {
        0% { opacity: 0; }
        30% { opacity: 1; }
        100% { opacity: 0; }
      }

      .corner {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        color: oklch(0.40 0.010 70);
        font-size: 10px;
        letter-spacing: 0.22em;
        text-align: center;
        text-transform: uppercase;
        white-space: nowrap;
      }

      @media (max-width: 820px) {
        .massar-auth-shell {
          overflow: auto;
        }

        .stage {
          position: relative;
          min-height: 100vh;
          padding: 96px 0 70px;
          overflow: hidden;
        }

        .wordmark {
          top: 28px;
          font-size: 15px;
          gap: 9px;
          letter-spacing: 0.12em;
        }

        .stage.lit .wordmark {
          letter-spacing: 0.14em;
        }

        .scene {
          width: min(420px, 92vw);
          height: auto;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .lamp-area {
          height: 330px;
        }

        .lamp {
          transform: scale(0.88);
        }

        .card-area {
          min-height: 440px;
          height: auto;
        }

        .card {
          width: 100%;
          max-height: none;
          padding: 34px 24px 28px;
        }

        .setup-card {
          padding-top: 28px;
        }

        .corner {
          bottom: 18px;
          width: 90vw;
          font-size: 9px;
          white-space: normal;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .stage,
        .glow,
        .shade,
        .shade-lip,
        .card,
        .wordmark,
        .wm-logo,
        .dot,
        .off-cue,
        .btn,
        .welcome-flash {
          animation-duration: 1ms !important;
          transition-duration: 1ms !important;
        }
      }
    `}</style>
  );
}
