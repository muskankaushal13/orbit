"use client";
import "@xyflow/react/dist/style.css";
import { useCallback, useRef } from "react";
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
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import { CARD_TYPES, type CardType } from "@/lib/card-types";
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
const jsonHeaders = { "Content-Type": "application/json" };
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
  const s = STYLE[data.cardType];
  const save = (patch: { title?: string; content?: string }) =>
    fetch(`/api/workspaces/${data.workspaceId}/cards/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    });
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
      <input
        className="nodrag w-full bg-transparent text-base font-bold outline-none"
        value={data.title}
        onChange={(e) => updateNodeData(id, { title: e.target.value })}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v) save({ title: v });
        }}
        aria-label="Card title"
      />
      <textarea
        className={`nodrag nowheel mt-2 h-20 w-full resize-none bg-transparent text-sm text-slate-300 outline-none ${
          data.cardType === "code" ? "font-mono text-xs" : ""
        }`}
        placeholder="Write here..."
        value={data.content}
        onChange={(e) => updateNodeData(id, { content: e.target.value })}
        onBlur={(e) => save({ content: e.target.value })}
        aria-label="Card content"
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes: NodeTypes = { card: CardNodeView };
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
      if (!res.ok) return;
      const row: CardRow = await res.json();
      setNodes((ns) => [...ns, toNode(row, workspaceId)]);
    },
    [base, screenToFlowPosition, setNodes, workspaceId],
  );
  const onConnect: OnConnect = useCallback(
    async (c) => {
      if (!c.source || !c.target) return;
      const res = await fetch(`${base}/links`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ fromCard: c.source, toCard: c.target }),
      });
      if (!res.ok) return;
      const row: LinkRow = await res.json();
      setEdges((es) =>
        es.some((e) => e.id === row.id)
          ? es
          : [...es, { id: row.id, source: row.fromCard, target: row.toCard }],
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
        onNodeDragStop={(_e, node) => {
          fetch(`${base}/cards/${node.id}`, {
            method: "PATCH",
            headers: jsonHeaders,
            body: JSON.stringify({ x: node.position.x, y: node.position.y }),
          });
        }}
        onNodesDelete={(deleted) =>
          deleted.forEach((n) => fetch(`${base}/cards/${n.id}`, { method: "DELETE" }))
        }
        onEdgesDelete={(deleted) =>
          deleted.forEach((e) => fetch(`${base}/links/${e.id}`, { method: "DELETE" }))
        }
        colorMode="dark"
        minZoom={0.1}
        maxZoom={2}
        fitView
      >
        <Background gap={28} />
        <Controls />
        <MiniMap pannable zoomable />
        <Panel position="top-left">
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-700 bg-slate-900/90 p-2">
            {CARD_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addCard(t)}
                className="min-h-11 rounded-lg border border-slate-600 px-3 text-sm text-slate-100 hover:bg-slate-800"
              >
                + {STYLE[t].label}
              </button>
            ))}
          </div>
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