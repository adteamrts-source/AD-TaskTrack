import { useState } from "react";
import { Loader2, Moon, Rocket, ShieldCheck, Sun } from "lucide-react";
import Starfield from "../components/Starfield";
import { useTheme } from "../lib/theme";
import "./login.css";

export default function Login() {
  const { theme, toggle } = useTheme();
  const [isLeaving, setIsLeaving] = useState(false);

  return (
    <main className="login-page">
      <Starfield />

      <button className="login-theme-toggle" type="button" onClick={toggle} aria-label="สลับธีม" title="สลับธีม">
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <section className="login-layout" aria-labelledby="login-title">
        <div className="login-identity">
          <div className="login-rocket-stage astro-float">
            <span className="login-rocket-glow astro-pulse-glow" />
            <span className="login-rocket-card">
              <Rocket size={64} strokeWidth={1.7} />
            </span>
          </div>

          <div>
            <h1 id="login-title" className="login-title">
              ASTRO<br /><span>SYSTEM</span>
            </h1>
            <p className="login-tagline">
              ศูนย์ปฏิบัติการสำหรับบริหารโครงการ<br />และภารกิจประจำวันของทีม RTS
            </p>
          </div>
        </div>

        <div className="login-panel-wrap">
          <div className="login-mobile-brand"><Rocket size={23} /> ASTRO</div>
          <div className="login-command-card">
            <span className="login-scanline" aria-hidden="true" />
            <div className="login-heading">
              <h2>ยืนยันตัวตน</h2>
              <p>เข้าสู่ศูนย์ปฏิบัติการด้วยบัญชี Google ของ RTS</p>
            </div>

            <a
              className="login-google-neon"
              href="/accounts/google/login/"
              onClick={() => setIsLeaving(true)}
              aria-busy={isLeaving}
            >
              <span className="login-button-sheen astro-shimmer" aria-hidden="true" />
              <span className="login-google-content">
                {isLeaving ? <Loader2 className="login-spinner" size={20} /> : <GoogleMark />}
                {isLeaving ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Google"}
              </span>
            </a>

            <div className="login-access-note">
              <ShieldCheck size={20} />
              <div>
                <strong>Secure workspace access</strong>
                <span>สำหรับบัญชีที่ได้รับอนุญาตโดยผู้ดูแลระบบ</span>
              </div>
            </div>
          </div>
          <p className="login-footer">RTS Project Operations · Asia/Bangkok</p>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
