import React, { useEffect, useRef, useState } from "react";

export default function InstallApp() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(
    () =>
      matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true,
  );
  const [waiting, setWaiting] = useState(null);
  const [message, setMessage] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    const offer = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
      dialog.current?.close();
    };
    const display = matchMedia("(display-mode: standalone)");
    const changed = () =>
      setInstalled(display.matches || navigator.standalone === true);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", done);
    display.addEventListener("change", changed);
    let alive = true;
    let registration;
    const check = () => registration?.update().catch(() => {});
    const updateFound = () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (
          alive &&
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        )
          setWaiting(registration.waiting);
      });
    };
    let reloading = false;
    const controlled = () => {
      if (!reloading) {
        reloading = true;
        location.reload();
      }
    };
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          if (!alive) return;
          registration = reg;
          if (reg.waiting) setWaiting(reg.waiting);
          reg.addEventListener("updatefound", updateFound);
          check();
        })
        .catch(() => {
          /* Installation guidance remains available without offline caching. */
        });
      navigator.serviceWorker.addEventListener("controllerchange", controlled);
      window.addEventListener("focus", check);
      window.addEventListener("online", check);
    }
    return () => {
      alive = false;
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", done);
      display.removeEventListener("change", changed);
      registration?.removeEventListener("updatefound", updateFound);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        controlled,
      );
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, []);
  async function install() {
    if (!prompt) {
      dialog.current?.showModal();
      return;
    }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(
        choice.outcome === "accepted"
          ? "追加操作を受け付けました。ホーム画面をご確認ください。"
          : "追加はキャンセルされました。ブラウザのメニューからも追加できます。",
      );
    } catch {
      dialog.current?.showModal();
    }
    setPrompt(null);
  }
  return (
    <>
      <div className="install-bar">
        <img src="/icons/icon.svg" width="36" height="36" alt="" />
        <div>
          <strong>
            {installed ? "ホーム画面から利用中" : "スマホのホーム画面に追加"}
          </strong>
          <span>アイコンから、すぐに計算できます。</span>
        </div>
        {!installed && (
          <button onClick={install}>
            {prompt ? "インストール" : "追加方法を見る"}
          </button>
        )}
      </div>
      {message && (
        <p className="install-message" role="status">
          {message}
        </p>
      )}
      {waiting && (
        <div className="install-update" role="status">
          <span>
            新しいデータ・アプリを利用できます。更新すると入力中の条件はリセットされます。必要な計算は履歴に保存してください。
          </span>
          <button onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}>
            更新して再読み込み
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="install-dialog"
        aria-labelledby="install-title"
      >
        <img
          src="/icons/icon-192.png"
          width="64"
          height="64"
          alt="アプリアイコン"
        />
        <h2 id="install-title">ホーム画面への追加方法</h2>
        <h3>iPhone・iPad</h3>
        <p>
          Safariでこのサイトを開き、共有メニュー
          →「ホーム画面に追加」→「追加」を選んでください。「Webアプリとして開く」が表示された場合はオンにします。
        </p>
        <h3>Android</h3>
        <p>
          Chromeでこのサイトを開き、右上のメニュー
          →「ホーム画面に追加」または「アプリをインストール」を選んでください。
        </p>
        <p>
          LINEなどのアプリ内ブラウザでは、Safari・Chromeで開き直してください。PCではChrome・Edgeのアドレスバーやメニューから追加できます。
        </p>
        <p>
          一度読み込むとオフラインでも利用できます。最新のランキングを受け取るときはインターネットに接続してください。
        </p>
        <form method="dialog">
          <button>閉じる</button>
        </form>
      </dialog>
    </>
  );
}
