"use client";

import { Activity, Clock3, Radio, WifiOff } from "lucide-react";
import dynamic from "next/dynamic";
import { ENVIRONMENTS } from "../../config/environments";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { overallStatus } from "../../state/selectors";
import { StatusBadge } from "../ui";

const EnvironmentPreview3D = dynamic(() => import("../scene/EnvironmentPreview3D").then((module) => module.EnvironmentPreview3D), {
  ssr: false,
  loading: () => <span className="environment-preview environment-preview--loading" />,
});

export function EnvironmentsOverview() {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  return (
    <main className="secondary-page">
      <div className="page-heading"><div><span className="eyebrow">Supervisor overview</span><h1>Monitored environments</h1><p>Independent buildings and forests reporting through decentralized sensor meshes.</p></div></div>
      <div className="environment-grid">
        {ENVIRONMENTS.map((definition) => {
          const environment = state.environments[definition.id];
          const status = overallStatus(environment);
          const active = environment.sensors.filter((sensor) => sensor.status !== "offline").length;
          const offline = environment.sensors.length - active;
          return <button type="button" key={definition.id} className="environment-card card" onClick={() => dispatch({ type: "select-environment", environmentId: definition.id })}>
            <EnvironmentPreview3D definition={definition} />
            <span className="environment-card__title"><span><strong>{definition.name}</strong><small>{definition.location}</small></span><StatusBadge status={status} dot={false}>{status}</StatusBadge></span>
            <span className="environment-card__metrics"><span><Radio size={14} /><strong>{active}</strong><small>active</small></span><span><WifiOff size={14} /><strong>{offline}</strong><small>offline</small></span><span><Activity size={14} /><strong>{environment.alerts.filter((alert) => alert.confirmed).length}</strong><small>alerts</small></span></span>
            <span className="environment-card__footer"><span><Clock3 size={13} /> Last sync</span><span>{new Date(environment.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></span>
          </button>;
        })}
      </div>
    </main>
  );
}
