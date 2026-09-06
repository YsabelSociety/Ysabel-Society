export default function YsabelLoginLogo() {
  return (
    <div className="login-logo-stage" aria-label="Ysabel Society">
      <img src="/contentpreview-app/login-wordmark.webp" width="1200" height="675" alt="Ysabel Society" fetchPriority="high" onError={(event) => { if (!event.currentTarget.src.endsWith('/login-logo-original.png')) event.currentTarget.src = '/contentpreview-app/login-logo-original.png'; }} />
    </div>
  );
}
