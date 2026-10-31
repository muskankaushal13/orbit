"use client";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import { CARD_TYPES, type CardType } from "@/lib/card-types";
import { saveCard, cancelSave, flushAll } from "@/lib/card-save";
import { tracked, useSaveStatus } from "@/lib/save-status";
export type CardRow = {
  id: string;
  type: CardType;
  title: string;
  content: string;
  x: number;
  y: number;
};
export type LinkRow = { id: string; fromCard: string; toCard: string };
type CardData = {
  title: string;
  content: string;
  cardType: CardType;
  workspaceId: string;
};
type CardNode = Node<CardData, "card">;
const STYLE: Record<CardType, { label: string; border: string; badge: string }> = {
  topic: { label: "Topic", border: "border-teal-400/60", badge: "text-teal-300" },
  note: { label: "Note", border: "border-slate-500/60", badge: "text-slate-300" },
  code: { label: "Code", border: "border-violet-400/60", badge: "text-violet-300" },
  project: { label: "Project", border: "border-amber-400/60", badge: "text-amber-300" },
  company: { label: "Company", border: "border-sky-400/60", badge: "text-sky-300" },
};
const MINI: Record<CardType, string> = {
  topic: "#2dd4bf",
  note: "#94a3b8",
  code: "#a78bfa",
  project: "#fbbf24",
  company: "#38bdf8",
};
const jsonHeaders = { "Content-Type": "application/json" };
type Level = "far" | "mid" | "near";
// far = zoomed out (titles), mid = preview, near = full editing
const useLevel = () =>
  useStore((s): Level => (s.transform[2] < 0.5 ? "far" : s.transform[2] < 1 ? "mid" : "near"));
const LEVEL_LABEL: Record<Level, string> = {
  far: "Topics view",
  mid: "Notes view",
  near: "Edit view",
};
function toNode(c: CardRow, workspaceId: string): CardNode {
  return {
    id: c.id,
    type: "card",
    position: { x: c.x, y: c.y },
    data: { title: c.title, content: c.content, cardType: c.type, workspaceId },
  };
}
function CardNodeView({ id, data, selected }: NodeProps<CardNode>) {
  const { updateNodeData } = useReactFlow();
  const level = useLevel();
  const s = STYLE[data.cardType];
  return (
    <div
      className={`w-64 rounded-xl border bg-slate-900 p-3 text-slate-100 shadow-lg transition-shadow ${s.border} ${
        selected ? "shadow-teal-400/30 ring-2 ring-teal-400/50" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className={`mb-1 text-[10px] font-medium uppercase tracking-widest ${s.badge}`}>
        {s.label}
      </div>
      {level === "far" ? (
        <div className="line-clamp-3 text-4xl font-bold leading-tight">{data.title}</div>
      ) : (
        <input
          className="nodrag w-full bg-transparent text-base font-bold outline-none"
          value={data.title}
          onChange={(e) => {
            updateNodeData(id, { title: e.target.value });
            const v = e.target.value.trim();
            if (v) saveCard(data.workspaceId, id, { title: v });
          }}
          aria-label="Card title"
        />
      )}
      {level === "mid" && (
        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-slate-300">
          {data.content || "No content yet"}
        </p>
      )}
      {level === "near" && (
        <textarea
          className={`nodrag nowheel mt-2 h-20 w-full resize-none bg-transparent text-sm text-slate-300 outline-none ${
            data.cardType === "code" ? "font-mono text-xs" : ""
          }`}
          placeholder="Write here..."
          value={data.content}
          onChange={(e) => {
            updateNodeData(id, { content: e.target.value });
            saveCard(data.workspaceId, id, { content: e.target.value });
          }}
          aria-label="Card content"
        />
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes: NodeTypes = { card: CardNodeView };
function StatusBadge() {
  const status = useSaveStatus();
  const level = useLevel();
  const text =
    status === "saving"
      ? "Saving..."
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Save failed"
          : "Autosave on";
  return (
    <div
      aria-live="polite"
      className={`flex gap-3 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm ${
        status === "error" ? "text-red-300" : "text-slate-300"
      }`}
    >
      <span>{text}</span>
      <span className="text-slate-500">|</span>
      <span>{LEVEL_LABEL[level]}</span>
    </div>
  );
}
function Board({
  workspaceId,
  initialCards,
  initialLinks,
}: {
  workspaceId: string;
  initialCards: CardRow[];
  initialLinks: LinkRow[];
}) {
  const base = `/api/workspaces/${workspaceId}`;
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNode>(
    initialCards.map((c) => toNode(c, workspaceId)),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialLinks.map((l) => ({ id: l.id, source: l.fromCard, target: l.toCard })),
  );
  const addCard = useCallback(
    async (type: CardType) => {
      const r = wrapper.current?.getBoundingClientRect();
      const center = screenToFlowPosition({
        x: (r?.left ?? 0) + (r?.width ?? 800) / 2,
        y: (r?.top ?? 0) + (r?.height ?? 600) / 2,
      });
      let row: CardRow | null = null;
      await tracked(async () => {
        const res = await fetch(`${base}/cards`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            type,
            title: `New ${STYLE[type].label.toLowerCase()}`,
            x: center.x - 128 + (Math.random() * 80 - 40),
            y: center.y - 60 + (Math.random() * 80 - 40),
          }),
        });
        if (res.ok) row = await res.clone().json();
        return res;
      });
      if (row) setNodes((ns) => [...ns, toNode(row as CardRow, workspaceId)]);
    },
    [base, screenToFlowPosition, setNodes, workspaceId],
  );
  // Keyboard shortcuts: 1-5 add a card (ignored while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const i = Number(e.key);
      if (i >= 1 && i <= CARD_TYPES.length) addCard(CARD_TYPES[i - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addCard]);
  // Send any pending debounced edits when the tab closes
  useEffect(() => {
    window.addEventListener("beforeunload", flushAll);
    return () => {
      flushAll();
      window.removeEventListener("beforeunload", flushAll);
    };
  }, []);
  const onConnect: OnConnect = useCallback(
    async (c) => {
      if (!c.source || !c.target) return;
      let row: LinkRow | null = null;
      await tracked(async () => {
        const res = await fetch(`${base}/links`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ fromCard: c.source, toCard: c.target }),
        });
        if (res.ok) row = await res.clone().json();
        return res;
      });
      if (!row) return;
      const l = row as LinkRow;
      setEdges((es) =>
        es.some((e) => e.id === l.id)
          ? es
          : [...es, { id: l.id, source: l.fromCard, target: l.toCard }],
      );
    },
    [base, setEdges],
  );
  return (
    <div ref={wrapper} className="h-screen w-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={(_e, node) =>
          saveCard(workspaceId, node.id, { x: node.position.x, y: node.position.y }, 200)
        }
        onNodesDelete={(deleted) =>
          deleted.forEach((n) => {
            cancelSave(workspaceId, n.id);
            void tracked(() => fetch(`${base}/cards/${n.id}`, { method: "DELETE" }), {
              allow404: true,
            });
          })
        }
        onEdgesDelete={(deleted) =>
          deleted.forEach((e) => {
            void tracked(() => fetch(`${base}/links/${e.id}`, { method: "DELETE" }), {
              allow404: true,
            });
          })
        }
        onlyRenderVisibleElements
        colorMode="dark"
        minZoom={0.1}
        maxZoom={2}
        fitView
      >
        <Background gap={28} />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => MINI[(n.data as CardData).cardType] ?? "#64748b"}
        />
        <Panel position="top-left">
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-700 bg-slate-900/90 p-2">
            {CARD_TYPES.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => addCard(t)}
                className="min-h-11 rounded-lg border border-slate-600 px-3 text-sm text-slate-100 hover:bg-slate-800"
              >
                + {STYLE[t].label} <span className="text-slate-500">({i + 1})</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel position="top-center">
          <StatusBadge />
        </Panel>
      </ReactFlow>
    </div>
  );
}
export default function Canvas(props: {
  workspaceId: string;
  initialCards: CardRow[];
  initialLinks: LinkRow[];
}) {
  return (
    <ReactFlowProvider>
      <Board {...props} />
    </ReactFlowProvider>
  );
}