import { createRoot } from "react-dom/client";
import App from "./App";
import { clearChunkReloadFlag } from "@/components/DeployChunkErrorBoundary";
import "./index.css";

clearChunkReloadFlag();
createRoot(document.getElementById("root")!).render(<App />);
