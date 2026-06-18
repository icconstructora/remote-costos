import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import HarnessApp from "./harness/HarnessApp";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <HarnessApp />
    </BrowserRouter>
  </React.StrictMode>
);
