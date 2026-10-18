import { getMessages } from "../i18n";
import { Component, type ErrorInfo, type ReactNode } from "react";

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    // No customer data, tokens or form values are sent to third-party telemetry.
    console.error("UI_ERROR", { name: error.name, path: location.pathname, time: new Date().toISOString() });
    try { const entries=JSON.parse(localStorage.getItem("t2t_error_log")||"[]");localStorage.setItem("t2t_error_log",JSON.stringify([...entries,{name:error.name,path:location.pathname,at:new Date().toISOString()}].slice(-30))); } catch {}
  }
  render() { return this.state.failed ? <main className="mx-auto max-w-xl space-y-4 p-10"><h1 className="text-xl font-bold">{getMessages().common.screenFailed}</h1><p>{getMessages().common.screenFailedHelp}</p><button className="rounded-lg bg-slate-900 px-4 py-2 text-white" onClick={()=>location.reload()}>{getMessages().common.reload}</button></main> : this.props.children; }
}
