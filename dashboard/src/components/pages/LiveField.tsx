"use client";

import { buildLiveGraph } from "../../domain/liveGraph";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { selectDashboard } from "../../state/selectors";
import { deriveAlertBanner } from "../operations/alertBannerModel";

/**
 * The field itself, with none of the building in it.
 *
 * Every pixel here comes from a packet: the circles are the boards, the lines
 * are the neighbours they talk to, the number inside each circle is the
 * distance from the hazard that the node computed on its own. Heat a board and
 * it turns red; unplug one and the graph reorganises. Nothing is staged, which
 * is the point: the twin next door is a model of a place, this is the network.
 */
export function LiveField() {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  const { environment } = selectDashboard(state);
  const graph = buildLiveGraph(environment, state.selectedSensorId);
  const banner = deriveAlertBanner(environment);
  const live = state.mode === "live";
  const online = graph.nodes.length - graph.offlineCount;
  // Crop to what is actually drawn, so three boards fill the screen as well as
  // twelve do: the discs are r=6.4 and the two labels hang 14 below them.
  const xs = graph.nodes.map((node) => node.x);
  const ys = graph.nodes.map((node) => node.y);
  const left = Math.min(...xs, 50) - 11;
  const top = Math.min(...ys, 30) - 11;
  const viewBox = graph.nodes.length
    ? `${left} ${top} ${Math.max(...xs) + 11 - left} ${Math.max(...ys) + 16 - top}`
    : "0 0 100 60";

  return (
    <main className="live-field" aria-label="Live field">
      <h1 className="sr-only">Live sensor network</h1>
      <header className="live-field__head">
        <div className={`live-field__status live-field__status--${banner.status}`}>
          <strong>{banner.label}</strong>
          <span>{banner.detail}</span>
        </div>
        {/* The simulated field has forty-four configured sensors; counting those
            here would say nothing about the boards on the table. */}
        <dl className="live-field__counts">
          <div><dt>Nodes on the air</dt><dd>{live ? `${online}/${graph.nodes.length}` : "—"}</dd></div>
          <div><dt>Hazard sources</dt><dd>{live ? (graph.sourceIds.length ? graph.sourceIds.join(", ") : "none") : "—"}</dd></div>
          <div><dt>Links</dt><dd>{live ? `${graph.links.filter((link) => link.active).length}/${graph.links.length}` : "—"}</dd></div>
        </dl>
      </header>

      <div className="live-field__canvas">
        {!live ? (
          // The simulated environment has forty-four configured sensors: drawing
          // them here would be a picture of the building again, which is the one
          // thing this view exists to avoid.
          <p className="live-field__notice">
            This view follows the physical boards.{" "}
            <button type="button" className="live-field__switch" onClick={() => dispatch({ type: "set-mode", mode: "live" })}>
              Switch to Live
            </button>{" "}
            to see them.
          </p>
        ) : graph.nodes.length === 0 ? (
          <p className="live-field__notice">No node has been heard yet.</p>
        ) : (
          <svg viewBox={viewBox} role="img" aria-label="Field graph" preserveAspectRatio="xMidYMid meet">
            {graph.links.map((link) => {
              const from = graph.nodes.find((node) => node.id === link.sourceId);
              const to = graph.nodes.find((node) => node.id === link.targetId);
              if (!from || !to) return null;
              return (
                <line
                  key={link.id}
                  className={`field-link${link.active ? "" : " field-link--down"}${link.escape ? " field-link--escape" : ""}`}
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                />
              );
            })}
            {graph.nodes.map((node) => (
              <g
                key={node.id}
                className={`field-node field-node--${node.status}${node.offline ? " field-node--offline" : ""}${node.isSource ? " field-node--source" : ""}`}
                transform={`translate(${node.x} ${node.y})`}
                onClick={() => dispatch({ type: "select-sensor", sensorId: node.id })}
                role="button"
                tabIndex={0}
                aria-label={`${node.id}, ${node.status}, distance ${node.distanceLabel}`}
                onKeyDown={(event) => { if (event.key === "Enter") dispatch({ type: "select-sensor", sensorId: node.id }); }}
              >
                {node.isSource ? <circle className="field-node__pulse" r="8.6" /> : null}
                <circle className="field-node__disc" r="6.4" strokeDasharray={node.offline || node.distance === null ? "1.6 1.4" : undefined} />
                <text className="field-node__distance" y="1.9" textAnchor="middle">{node.distanceLabel}</text>
                <text className="field-node__id" y="10.4" textAnchor="middle">{node.id}</text>
                <text className="field-node__reading" y="13.6" textAnchor="middle">
                  {node.temperature === null ? "—" : `${node.temperature.toFixed(1)}°`}
                  {node.simulated ? " sim" : ""}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      <footer className="live-field__legend">
        <span><i className="dot dot--critical" />source, distance 0</span>
        <span><i className="dot dot--warning" />one hop away</span>
        <span><i className="dot dot--safe" />further away</span>
        <span><i className="dot dot--offline" />not heard for four seconds</span>
        <span>· no hazard anywhere · ? no path to it</span>
        <span className="live-field__readonly">Dashboard is read-only: the network works without it.</span>
      </footer>
    </main>
  );
}
