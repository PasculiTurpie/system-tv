// src/pages/ServicesMultiHost.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import api from "../../utils/api";

/**
 * Listado de Señales desde múltiples hosts Titan
 * - Descubre hosts Titan desde api.getEquipo() (tipoNombre.tipoNombre === "titan")
 * - Consulta en paralelo las APIs Titans directamente (sin proxy intermedio)
 * - Columnas: Name, Input.IPInputList.Url, Outputs[0].Outputs, Fuente (pattern/still/live/fail), State.State
 * - Botón Exportar CSV (aplica al filtrado)
 */

const PROTOCOL = "http";
const TITAN_SERVICES_PATH = "/api/v1/servicesmngt/services";
const env =
  typeof import.meta !== "undefined" && import.meta?.env ? import.meta.env : {};
const TITAN_USERNAME = env.VITE_TITAN_USERNAME || "Operator";
const TITAN_PASSWORD = env.VITE_TITAN_PASSWORD || "titan";
const TITAN_REQUEST_OPTIONS = {
  path: TITAN_SERVICES_PATH,
  username: TITAN_USERNAME,
  password: TITAN_PASSWORD,
};

// ───────────────────────── estado de hosts Titan (dinámico vía getEquipo) ─────────────────────────
const useTitanHosts = () => {
  const [hosts, setHosts] = useState([]); // [{label, ip}]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadHosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getEquipo();
      const equipos = Array.isArray(response?.data) ? response.data : [];
      const seenIps = new Set();
      const titanHosts = [];

      for (const item of equipos) {
        const typeNameRaw = pickFirst(
          item?.tipoNombre?.tipoNombre,
          item?.tipoNombre?.nombre,
          item?.tipoNombre,
          item?.tipo,
          item?.tipo_equipo
        );
        const typeName =
          typeof typeNameRaw === "string" ? typeNameRaw.trim().toLowerCase() : "";

        if (!typeName || !typeName.includes("titan")) {
          continue;
        }

        const ip = pickFirst(item?.ip_gestion, item?.ipGestion);
        const normalizedIp = ip ? String(ip).trim() : "";
        if (!normalizedIp || seenIps.has(normalizedIp)) continue;

        seenIps.add(normalizedIp);
        const rawName = item?.nombre ? String(item.nombre).trim() : "";
        titanHosts.push({
          label: rawName || normalizedIp || "(sin nombre)",
          ip: normalizedIp,
        });
      }

      titanHosts.sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
      );

      if (titanHosts.length === 0) {
        setError("No se encontraron equipos Titan con IP de gestión configurada.");
      }
      setHosts(titanHosts);
    } catch (err) {
      setHosts([]);
      setError(`Equipos Titan: ${describeError(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { hosts, loading, error, loadHosts, setHosts };
};

// Anchos fijos de columnas críticas (tabla principal)
const COL_WIDTHS = {
  fuente: 260,
  estado: 140,
};

/* ───────────────────────── utils ───────────────────────── */

function pickFirst(...cands) {
  for (const v of cands) if (v !== undefined && v !== null) return v;
  return undefined;
}

/** get(obj, 'Outputs[0][0].Outputs[0].Url') seguro (soporta [idx] y .prop) */
function get(obj, path, def = undefined) {
  if (!obj || !path) return def;
  const norm = String(path)
    .replace(/\[(\w+)\]/g, ".$1") // [0] -> .0
    .replace(/^\./, "");
  const out = norm.split(".").reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
  return out === undefined ? def : out;
}

/** extrae el array de servicios desde múltiples formas de respuesta */
function extractServicesArray(resp) {
  const r = resp ?? {};
  if (Array.isArray(r)) return r;
  if (Array.isArray(r.services)) return r.services;
  if (Array.isArray(r.Services)) return r.Services;
  if (Array.isArray(r.data?.services)) return r.data.services;
  if (Array.isArray(r.data?.Services)) return r.data.Services;
  if (Array.isArray(r.result)) return r.result;
  return [];
}

/* ───────────────────────── detección de fuente ───────────────────────── */
const FAIL_NAMES = new Set([
  "Video Signal Missing",
  "Audio Signal Silent",
  "Video Signal Frozen",
  "Input Source Loss",
]);

function detectVideoSource(svc) {
  const state = get(svc, "State.State");
  const streaming = !!get(svc, "State.Streaming", false);

  const msgs = get(svc, "State.Messages", []);
  const failMsgs = Array.isArray(msgs)
    ? msgs.filter((m) => {
        if (!m) return false;
        if (typeof m === "string") return FAIL_NAMES.has(m);
        const name = m.Name;
        return typeof name === "string" && FAIL_NAMES.has(name);
      })
    : [];

  const emuMode = get(svc, "Device.Template.Tracks.VideoTracks[0].EmulationMode.Mode", "Off");
  const patternName = get(svc, "Device.Template.Tracks.VideoTracks[0].EmulationMode.PatternName", null);
  const stillPictureEnabled = !!get(svc, "Device.Template.Tracks.VideoTracks[0].Variants[0].StillPicture", false);
  const stillPictureFilename = get(svc, "Device.Template.Tracks.VideoTracks[0].Variants[0].StillPictureFilename", null);

  const liveInputUrl = pickFirst(
    get(svc, "Input[0].IPInputList[0].Url"),
    get(svc, "Input.IPInputList[0].Url"),
    get(svc, "IPInputList[0].Url"),
    get(svc, "Input.Url"),
    get(svc, "InputUrl")
  );

  if (failMsgs.length > 0) {
    const reason = failMsgs
      .map((m) => (typeof m === "string" ? m : m?.Name || m?.Description))
      .filter(Boolean)
      .join(" | ");
    return {
      encodingState: state,
      streaming,
      mode: "fail",
      sourceName: reason || liveInputUrl || "(input issue)",
      reason: reason || null,
      liveInputUrl,
      emulationMode: emuMode,
      patternName,
      stillPictureEnabled,
      stillPictureFilename,
    };
  }

  if (emuMode && String(emuMode).toLowerCase() === "pattern") {
    return {
      encodingState: state,
      streaming,
      mode: "pattern",
      sourceName: patternName ?? "(pattern)",
      reason: null,
      liveInputUrl,
      emulationMode: emuMode,
      patternName,
      stillPictureEnabled,
      stillPictureFilename,
    };
  }

  if (stillPictureEnabled) {
    return {
      encodingState: state,
      streaming,
      mode: "still",
      sourceName: stillPictureFilename ?? "(still picture)",
      reason: null,
      liveInputUrl,
      emulationMode: emuMode,
      patternName,
      stillPictureEnabled,
      stillPictureFilename,
    };
  }

  return {
    encodingState: state,
    streaming,
    mode: "live",
    sourceName: liveInputUrl ?? "",
    reason: null,
    liveInputUrl,
    emulationMode: emuMode,
    patternName,
    stillPictureEnabled,
    stillPictureFilename,
  };
}

/* ───────────────────────── extracción por fila ───────────────────────── */
function extractRow(hostLabel, ip, svc) {
  const s = svc ?? {};
  const name = pickFirst(get(s, "Name"), get(s, "name"), get(s, "ServiceName"), get(s, "serviceName"));

  const inputUrl = pickFirst(
    get(s, "Input[0].IPInputList[0].Url"),
    get(s, "Input.IPInputList[0].Url"),
    get(s, "IPInputList[0].Url"),
    get(s, "Input.Url"),
    get(s, "InputUrl")
  );

  const outputUrlExact = pickFirst(get(s, "Outputs[0][0].Outputs[0].Url"), get(s, "Outputs[0][0].Outputs.Url"));
  const outputUrlFallback = pickFirst(
    get(s, "Outputs[0].Outputs[0].Url"),
    get(s, "Outputs[0].Outputs.Url"),
    get(s, "Outputs[0][0].Outputs[0]"),
    get(s, "Outputs[0].Url"),
    get(s, "Outputs.Url"),
    get(s, "Output.Url")
  );
  const outputUrl = pickFirst(outputUrlExact, outputUrlFallback);

  const stateVal = pickFirst(get(s, "State.State"), get(s, "state.state"), get(s, "State"), get(s, "state"));

  const src = detectVideoSource(s);
  const sourceText =
    src.mode === "fail"
      ? `fail: ${src.sourceName ?? ""}`
      : src.mode === "pattern"
      ? `pattern: ${src.sourceName ?? ""}`
      : src.mode === "still"
      ? `still: ${src.sourceName ?? ""}`
      : `live: ${src.sourceName ?? ""}`;

  return {
    host: hostLabel,
    ip,
    name: name ?? "(sin nombre)",
    inputUrl: inputUrl ?? "",
    outputs: outputUrl ?? "",
    sourceMode: src.mode,
    sourceName: src.sourceName ?? "",
    sourceText,
    state: typeof stateVal === "object" ? JSON.stringify(stateVal) : stateVal ?? "",
  };
}

/* ───────────────────────── Titans helpers ───────────────────────── */

function describeError(error) {
  if (!error) return "Error desconocido";
  if (typeof error === "string") return error;
  const response = error.response;
  if (response) {
    const status = response.status ?? "?";
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    const data = response.data;
    let detail = "";
    if (data) {
      if (typeof data === "string") detail = data;
      else if (typeof data?.error === "string") detail = data.error;
      else if (typeof data?.message === "string") detail = data.message;
      else {
        try {
          detail = JSON.stringify(data);
        } catch {
          detail = String(data);
        }
      }
      if (detail) detail = ` - ${detail}`;
    }
    return `HTTP ${status}${statusText}${detail}`.trim();
  }
  if (error?.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function describeTitanEntryError(entry) {
  if (!entry) return "sin datos";
  if (typeof entry === "string") return entry;
  if (entry.error) {
    if (typeof entry.error === "string") return entry.error;
    if (entry.error?.message) return entry.error.message;
    try {
      return JSON.stringify(entry.error);
    } catch {
      return String(entry.error);
    }
  }
  if (entry.message) return entry.message;
  if (entry.status || entry.statusText) {
    const status = entry.status ?? "?";
    const text = entry.statusText ? ` ${entry.statusText}` : "";
    return `HTTP ${status}${text}`.trim();
  }
  return "error desconocido";
}

function unwrapTitanPayload(entry) {
  if (!entry || typeof entry !== "object") return entry;
  if (entry.data !== undefined) return entry.data;
  if (entry.payload !== undefined) return entry.payload;
  if (entry.body !== undefined) return entry.body;
  if (entry.result !== undefined) return entry.result;
  return entry;
}

function normalizeTitanMultiResponse(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.hosts)) return payload.hosts;
  return [];
}

function getEntryHost(entry) {
  if (!entry) return null;
  return (
    entry.host ??
    entry.ip ??
    entry.hostIp ??
    entry.hostname ??
    (typeof entry === "object" && typeof entry.host === "string" ? entry.host : null)
  );
}

function isEntryOk(entry) {
  if (!entry) return false;
  if (typeof entry.ok === "boolean") return entry.ok;
  if ("error" in entry && entry.error) return false;
  if (entry.status !== undefined) {
    const status = Number(entry.status);
    if (!Number.isNaN(status)) return status >= 200 && status < 300;
  }
  return true;
}

function processTitanEntries(entries, hostMap) {
  const rows = [];
  const errors = [];
  const seenHosts = new Set();

  for (const entry of entries) {
    const hostIp = getEntryHost(entry);
    if (hostIp) seenHosts.add(hostIp);
    const hostInfo = hostMap.get(hostIp) || {
      label: hostIp ?? "(desconocido)",
      ip: hostIp ?? "(desconocido)",
    };

    if (isEntryOk(entry)) {
      const payload = unwrapTitanPayload(entry);
      const services = extractServicesArray(payload);
      rows.push(
        ...services.map((svc) => extractRow(hostInfo.label, hostInfo.ip, svc))
      );
    } else {
      errors.push(`${hostInfo.label} (${hostInfo.ip}): ${describeTitanEntryError(entry)}`);
    }
  }

  return { rows, errors, seenHosts };
}

/* ───────────────────────── CSV ───────────────────────── */

function escapeCsvField(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows) {
  const headers = ["Host", "IP", "Name", "Input.IPInputList.Url", "Outputs[0].Outputs.Url", "Fuente", "State.State"];
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const r of rows) {
    lines.push(
      [r.host, r.ip, r.name, r.inputUrl, typeof r.outputs === "string" ? r.outputs : JSON.stringify(r.outputs), r.sourceText, r.state]
        .map(escapeCsvField)
        .join(",")
    );
  }
  return lines.join("\r\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Helpers UI */
function hostHref(ip) {
  if (!ip) return "#";
  return `${PROTOCOL}://${ip}`;
}

/* ───────────────────────── Componente ───────────────────────── */

export default function ServicesMultiHost() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [query, setQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const timerRef = useRef(null);
  const searchRef = useRef(null);


  // hosts Titan desde backend
  const { hosts, loading: hostsLoading, error: hostFetchError, loadHosts } = useTitanHosts();

  // Carga de servicios usando los hosts descubiertos
  const loadAll = useCallback(async () => {
    if (!hosts || hosts.length === 0) {
      setRows([]);
      setErrors(hostFetchError ? [hostFetchError] : ["No hay hosts Titan para consultar."]);
      return;
    }

    setLoading(true);
    setErrors([]);

    const hostMap = new Map(hosts.map((item) => [item.ip, item]));
    const hostIps = hosts.map((item) => item.ip);
    let nextRows = [];
    let nextErrors = [];

    const pushRowsFromHost = (hostInfo, payload) => {
      const services = extractServicesArray(payload);
      nextRows.push(
        ...services.map((svc) => extractRow(hostInfo.label, hostInfo.ip, svc))
      );
    };

    try {
      const multiResponse = await api.getTitanServicesMulti(
        hostIps,
        TITAN_REQUEST_OPTIONS
      );
      const entries = normalizeTitanMultiResponse(multiResponse);
      const processed = processTitanEntries(entries, hostMap);

      nextRows = [...processed.rows];
      nextErrors = [...processed.errors];

      // Fallback: por si alguno no vino en el multi
      const missingHosts = hostIps.filter((ip) => !processed.seenHosts.has(ip));
      if (missingHosts.length > 0) {
        const settled = await Promise.allSettled(
          missingHosts.map((ip) =>
            api.getTitanServices(ip, TITAN_REQUEST_OPTIONS)
          )
        );

        settled.forEach((result, index) => {
          const ip = missingHosts[index];
          const hostInfo = hostMap.get(ip) || { label: ip, ip };
          if (result.status === "fulfilled") {
            pushRowsFromHost(hostInfo, result.value);
          } else {
            nextErrors.push(
              `${hostInfo.label} (${hostInfo.ip}): ${describeError(result.reason)}`
            );
          }
        });
      }
    } catch (err) {
      // Fallback total: per-host
      nextRows = [];
      nextErrors = [`Titans multi-host: ${describeError(err)}`];

      const settled = await Promise.allSettled(
        hosts.map((host) => api.getTitanServices(host.ip, TITAN_REQUEST_OPTIONS))
      );

      settled.forEach((result, index) => {
        const hostInfo = hosts[index];
        if (result.status === "fulfilled") {
          pushRowsFromHost(hostInfo, result.value);
        } else {
          nextErrors.push(
            `${hostInfo.label} (${hostInfo.ip}): ${describeError(result.reason)}`
          );
        }
      });
    }

    setRows(nextRows);
    setErrors(nextErrors);
    setLoading(false);
  }, [hosts, hostFetchError]);

  // 1) Descubrir hosts en el montaje
  useEffect(() => {
    loadHosts();
  }, [loadHosts]);

  // 2) Cuando cambien los hosts (o terminen de cargar), ejecutar la carga de servicios
  useEffect(() => {
    if (!hostsLoading) {
      // si hubo error al cargar hosts, igual refleja en errores
      if (hostFetchError) {
        setErrors((e) => (e.includes(hostFetchError) ? e : [...e, hostFetchError]));
      }
      // si hay hosts, cargar servicios
      if (hosts.length > 0) {
        loadAll();
      } else if (!hostFetchError) {
        // sin hosts y sin error explícito
        setRows([]);
      }
    }
  }, [hostsLoading, hosts, hostFetchError, loadAll]);

  // 3) Auto-refresh cada 30s, solo si hay hosts
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(() => {
      loadAll();
    }, 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [autoRefresh, loadAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.host, r.ip, r.name, r.inputUrl, r.outputs, r.sourceText, r.state]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  const failingRows = useMemo(
    () => filtered.filter((r) => r.sourceMode === "fail" || r.state === "Stopped"),
    [filtered]
  );

  const handleExportCsv = useCallback(() => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
    const csv = rowsToCsv(filtered);
    downloadText(`titan_signals_${stamp}.csv`, csv);
  }, [filtered]);

  const handleClear = useCallback(() => {
    setQuery("");
    if (searchRef.current) {
      searchRef.current.focus();
      if (typeof searchRef.current.select === "function") {
        searchRef.current.select();
      }
    }
  }, []);

  const titanSignalsCount = filtered.length;

  return (
    <div style={{ padding: 16 }}>
      {/* estilos de botones + buscador */}
      <style>{`
        .btn {
          appearance: none;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 50ms ease, color 120ms ease;
          background: #f6f8fa;
          color: #24292f;
        }
        .btn:hover:not(:disabled) { background: #eef1f4; }
        .btn:active:not(:disabled) { transform: translateY(1px); }
        .btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(9,105,218,0.3);
          border-color: #0969da;
        }
        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.85;
        }

        .btn-primary {
          background: #0969da;
          color: #ffffff;
          border-color: #0969da;
        }
        .btn-primary:hover:not(:disabled) { background: #085ec2; border-color: #085ec2; }

        .btn-outline {
          background: #ffffff;
          color: #24292f;
          border-color: #d0d7de;
        }
        .btn-outline:hover:not(:disabled) { background: #f6f8fa; border-color: #c2c8ce; }

        .btn-orange {
          background: #f59e0b;
          color: #ffffff;
          border-color: #f59e0b;
        }
        .btn-orange:hover:not(:disabled) { background: #d97706; border-color: #d97706; }
        .btn-orange:active:not(:disabled) { background: #c76a05; border-color: #c76a05; }
        .btn-orange:disabled {
          background: #d1d5db !important;
          border-color: #d1d5db !important;
          color: #4b5563 !important;
          opacity: 1;
        }

        .search-input {
          flex: 1 1 auto;
          padding: 8px 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #111827;
          transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
        }
        .search-input::placeholder { color: #6b7280; }
        .search-input:hover { border-color: #c7ccd1; }
        .search-input:focus {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96,165,250,0.35);
        }
        .search-input:focus-visible {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96,165,250,0.35);
        }
      `}</style>

      <h2
        style={{
          margin: 0,
          marginBottom: 8,
          display: "flex",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span>Listado de señales (Titan)</span>
        <span style={{ fontSize: 16, color: "#6b7280" }}>({`Total señales: ${titanSignalsCount}`})</span>
      </h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar (host, IP, nombre, url, fuente, estado, outputs...)"
          className="search-input"
        />
        <button
          onClick={handleClear}
          disabled={!query}
          className="btn btn-orange btn-clear"
          aria-label="Limpiar búsqueda"
          title="Limpiar búsqueda"
        >
          Limpiar
        </button>
        <button onClick={loadAll} disabled={loading || hostsLoading || hosts.length === 0} className="btn btn-primary">
          {loading ? "Cargando..." : "Refrescar"}
        </button>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            disabled={hostsLoading || hosts.length === 0}
          />
          Auto 30s
        </label>
        <button onClick={handleExportCsv} disabled={filtered.length === 0} className="btn btn-outline">
          Exportar CSV
        </button>
      </div>

      {/* Estado de carga/errores de hosts */}
      {(hostsLoading || hostFetchError) && (
        <div style={{ background: "#fffbea", border: "1px solid #fcd34d", padding: 8, marginBottom: 12 }}>
          {hostsLoading ? "Descubriendo hosts Titan..." : hostFetchError}
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ background: "#fff4f4", border: "1px solid #f5c2c7", padding: 8, marginBottom: 12 }}>
          <strong>Errores de conexión:</strong>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {errors.map((er, i) => (
              <li key={i} style={{ whiteSpace: "pre-wrap" }}>{er}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabla de señales en falla */}
      {failingRows.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <strong>Señales en falla</strong>
            <span style={{ fontSize: 12, color: "#666" }}>({failingRows.length})</span>
          </div>
          <div
            style={{
              display: "inline-block",
              border: "1px solid #f0c4c4",
              background: "#fffafa",
              padding: 0,
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                tableLayout: "auto",
                width: "auto",
                display: "inline-table",
                fontSize: 14,
              }}
            >
              <thead style={{ background: "#fdeeee" }}>
                <tr>
                  <th style={{ ...thCompact, width: 36, maxWidth: 36, textAlign: "center" }}> </th>
                  <th style={thCompact}>Name</th>
                  <th style={thCompact}>IP</th>
                  <th style={thCompact}>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {failingRows.map((r, i) => (
                  <tr key={`fail-${r.ip}-${i}`}>
                    <td style={{ ...tdCompact, width: 36, maxWidth: 36, textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: "red",
                        }}
                        title="fail"
                      />
                    </td>
                    <td style={tdCompact} title={r.name}>
                      {r.name}
                    </td>
                    <td style={{ ...tdCompact }}>
                      <a
                        href={hostHref(r.ip)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "underline", whiteSpace: "nowrap" }}
                        title={`${PROTOCOL}://${r.ip}`}
                      >
                        {r.ip}
                      </a>
                    </td>
                    <td style={tdCompact} title={r.sourceText}>
                      {r.sourceText}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla principal */}
      <div style={{ overflow: "auto", maxHeight: "75vh", border: "1px solid #ddd" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
          <thead style={{ position: "sticky", top: 0, background: "#fafafa" }}>
            <tr>
              <th style={th}>Host</th>
              <th style={th}>IP</th>
              <th style={th}>Name</th>
              <th style={th}>Multicast entrada</th>
              <th style={th}>Multicast salida</th>
              <th style={{ ...th, width: COL_WIDTHS.fuente, maxWidth: COL_WIDTHS.fuente }}>Fuente</th>
              <th style={{ ...th, width: COL_WIDTHS.estado, maxWidth: COL_WIDTHS.estado }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, textAlign: "center", color: "#666" }}>
                  {(loading || hostsLoading) ? "Cargando..." : "Sin datos para mostrar"}
                </td>
              </tr>
            ) : (
              filtered.map((r, idx) => {
                const stateText = r.state === "Stopped" ? "Stopped (fail)" : r.state;
                const isStateFail = r.sourceMode === "fail" || r.state === "Stopped";
                return (
                  <tr key={`${r.ip}-${idx}`}>
                    <td style={td}>{r.host}</td>
                    <td style={td}>
                      <a
                        href={hostHref(r.ip)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "underline", whiteSpace: "nowrap" }}
                        title={`${PROTOCOL}://${r.ip}`}
                      >
                        {r.ip}
                      </a>
                    </td>
                    <td style={td}>{r.name}</td>
                    <td
                      style={{ ...td, whiteSpace: "nowrap", maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis" }}
                      title={r.inputUrl}
                    >
                      {r.inputUrl}
                    </td>
                    <td
                      style={{ ...td, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis" }}
                      title={typeof r.outputs === "string" ? r.outputs : JSON.stringify(r.outputs)}
                    >
                      {typeof r.outputs === "string" ? r.outputs : JSON.stringify(r.outputs)}
                    </td>

                    {/* FUENTE */}
                    <td
                      style={{
                        ...td,
                        width: COL_WIDTHS.fuente,
                        maxWidth: COL_WIDTHS.fuente,
                        whiteSpace: "nowrap",
                      }}
                      title={r.sourceText}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            flex: "0 0 auto",
                            backgroundColor: r.sourceMode === "fail" ? "#d9534f" : "green",
                          }}
                        />
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                            flex: "1 1 auto",
                          }}
                        >
                          {r.sourceText}
                        </span>
                      </div>
                    </td>

                    {/* ESTADO */}
                    <td
                      style={{
                        ...td,
                        width: COL_WIDTHS.estado,
                        maxWidth: COL_WIDTHS.estado,
                        whiteSpace: "nowrap",
                      }}
                      title={stateText}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            flex: "0 0 auto",
                            backgroundColor: isStateFail ? "red" : "green",
                          }}
                        />
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                            flex: "1 1 auto",
                          }}
                        >
                          {stateText}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Encabezados (centrados) y celdas */
const th = {
  textAlign: "center",
  padding: "10px 8px",
  borderBottom: "1px solid #ddd",
  position: "sticky",
  top: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const td = {
  padding: "8px 8px",
  borderBottom: "1px solid #eee",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/* Encabezados/celdas compactas para la tabla de fallas (contenido ajustado) */
const thCompact = {
  textAlign: "center",
  padding: "8px 8px",
  borderBottom: "1px solid #f0c4c4",
  whiteSpace: "nowrap",
};

const tdCompact = {
  padding: "6px 8px",
  borderBottom: "1px solid #fdeeee",
  whiteSpace: "nowrap",
};
