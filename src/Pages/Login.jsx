import { IoMailOutline, IoLockClosedOutline } from "react-icons/io5";
import { CiUser } from "react-icons/ci";

import { LoginFirebase } from "../../firebase";
import { useNavigate } from "react-router-dom";

import { useState, useEffect } from "react";

const errorCodes = {
  "auth/email-already-exists": "Email already is already in use",
  "auth/invalid-email": "Invalid email",
  "auth/missing-email": "Missing email",
  "auth/missing-password": "Missing password",
  "auth/invalid-credential": "Invalid credential",
};

function Login() {
  const navigate = useNavigate();

  const [action, setAction] = useState("login");
  const [error, setError] = useState(null);
  const [showError, setShowError] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleClick() {
    if (action == "signup" && username.length < 3) {
      setError("Username must be at least three characters long");
      return;
    }
    const result = await LoginFirebase(action, username, email, password);
    if (result == "success") {
      navigate("/main");
    }
    setError(result);
  }

  useEffect(() => {
    if (!error) return;
    setShowError(true);
    const displayTimer = setTimeout(() => setShowError(false), 5000);
    const errorTimer = setTimeout(() => setError(null), 6000);
    return () => {
      (clearTimeout(displayTimer), clearTimeout(errorTimer));
    };
  }, [error]);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex items-center justify-center bg-[#0d0c0b]">
      <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; font-family: 'DM Sans', sans-serif; margin: 0; padding: 0; }

    @keyframes drift {
      0%   { transform: translate(0px, 0px) rotate(0deg); }
      33%  { transform: translate(6px, -4px) rotate(0.4deg); }
      66%  { transform: translate(-4px, 5px) rotate(-0.3deg); }
      100% { transform: translate(0px, 0px) rotate(0deg); }
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes expand {
      from { max-height: 0; opacity: 0; }
      to   { max-height: 64px; opacity: 1; }
    }
    @keyframes collapse {
      from { max-height: 64px; opacity: 1; }
      to   { max-height: 0; opacity: 0; }
    }

    .mesh { animation: drift 18s ease-in-out infinite; }

    .card {
      animation: cardIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      background: rgba(18, 16, 14, 0.85);
      border: 1px solid rgba(251, 191, 36, 0.12);
      border-radius: 20px;
      padding: 48px 44px 40px;
      width: min(400px, 92vw);
      display: flex;
      flex-direction: column;
      align-items: stretch;
      backdrop-filter: blur(12px);
    }

    .field {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 10px;
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      transition: border-color 0.3s;
    }
    .field:focus-within { border-color: rgba(251,191,36,0.5); }
    .field:focus-within .ficon { color: rgba(251,191,36,0.7); }

    .ficon {
      color: rgba(255,255,255,0.2);
      font-size: 15px;
      flex-shrink: 0;
      transition: color 0.3s;
    }

    .field input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: rgba(255,255,255,0.75);
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
    }
    .field input::placeholder { color: rgba(255,255,255,0.2); }
    .field input:focus { color: white; }

    .username-wrap.open   { animation: expand  0.35s ease forwards; overflow: hidden; }
    .username-wrap.closed { animation: collapse 0.35s ease forwards; overflow: hidden; }

    .cta {
      width: 100%;
      padding: 13px;
      background: #f59e0b;
      color: #0d0c0b;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.03em;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      margin-bottom: 16px;
    }
    .cta:hover  { background: #fbbf24; }
    .cta:active { transform: scale(0.98); }

    .toggle-row {
      text-align: center;
      font-size: 12px;
      color: rgba(255,255,255,0.25);
    }
    .toggle-row a {
      color: rgba(251,191,36,0.65);
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
      transition: color 0.2s;
    }
    .toggle-row a:hover { color: #fbbf24; }

    .error-msg {
      font-size: 12px;
      color: #f87171;
      text-align: center;
      min-height: 18px;
      margin-bottom: 18px;
    }
    .error-msg.show { animation: fadeIn  0.3s ease forwards; }
    .error-msg.hide { animation: fadeOut 0.3s ease forwards; opacity: 0; }

    .divider {
      width: 32px;
      height: 1px;
      background: rgba(251,191,36,0.3);
      margin: 18px auto 22px;
    }
  `}</style>

      {/* ── Background mesh ───────────────────────────── */}
      <svg
        className="mesh absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((x) => (
          <line
            key={`v${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2="700"
            stroke="rgba(251,191,36,0.04)"
            strokeWidth="1"
          />
        ))}
        {[0, 100, 200, 300, 400, 500, 600, 700].map((y) => (
          <line
            key={`h${y}`}
            x1="0"
            y1={y}
            x2="1000"
            y2={y}
            stroke="rgba(251,191,36,0.04)"
            strokeWidth="1"
          />
        ))}
        <line
          x1="0"
          y1="0"
          x2="500"
          y2="700"
          stroke="rgba(251,191,36,0.06)"
          strokeWidth="1"
        />
        <line
          x1="200"
          y1="0"
          x2="700"
          y2="700"
          stroke="rgba(251,191,36,0.05)"
          strokeWidth="1"
        />
        <line
          x1="500"
          y1="0"
          x2="1000"
          y2="700"
          stroke="rgba(251,191,36,0.06)"
          strokeWidth="1"
        />
        <line
          x1="1000"
          y1="0"
          x2="500"
          y2="700"
          stroke="rgba(251,191,36,0.04)"
          strokeWidth="1"
        />
        <path
          d="M40,40 L40,80 M40,40 L80,40"
          stroke="rgba(251,191,36,0.18)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M960,40 L960,80 M960,40 L920,40"
          stroke="rgba(251,191,36,0.18)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M40,660 L40,620 M40,660 L80,660"
          stroke="rgba(251,191,36,0.18)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M960,660 L960,620 M960,660 L920,660"
          stroke="rgba(251,191,36,0.18)"
          strokeWidth="1"
          fill="none"
        />
        {[200, 400, 600, 800].map((x) =>
          [140, 280, 420, 560].map((y) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="1.5"
              fill="rgba(251,191,36,0.08)"
            />
          )),
        )}
        <circle
          cx="500"
          cy="350"
          r="280"
          stroke="rgba(251,191,36,0.05)"
          strokeWidth="1"
          fill="none"
        />
        <circle
          cx="500"
          cy="350"
          r="180"
          stroke="rgba(251,191,36,0.04)"
          strokeWidth="1"
          fill="none"
        />
      </svg>

      <div className="card relative z-10">
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          <span className="font-special! text-[42px] text-white tracking-[-0.02em] leading-none">
            <span className="text-primary! font-special!">N</span>otify
          </span>
        </div>
        <p className="text-center text-[12px] text-white/25 tracking-[0.12em] uppercase mb-1">
          {action === "login" ? "sign in to continue" : "create your account"}
        </p>

        <div className="divider" />

        <div
          className={`username-wrap ${action === "signup" ? "open" : "closed"}`}
        >
          <div className="field">
            <CiUser className="ficon" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <IoMailOutline className="ficon" />
          <input
            type="text"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <IoLockClosedOutline className="ficon" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <p className={`error-msg ${showError ? "show" : "hide"}`}>
          {errorCodes[error] || error}
        </p>

        <button className="cta" onClick={handleClick}>
          {action === "login" ? "Login" : "Create account"}
        </button>

        <div className="toggle-row">
          {action === "login" ? "No account yet? " : "Already have one? "}
          <a
            onClick={() =>
              action === "login" ? setAction("signup") : setAction("login")
            }
          >
            {action === "login" ? "Sign up" : "Login"}
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
