"use client";

import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Clock3,
  History,
  Monitor,
  PackageCheck,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { firebaseReady, getRecord, watchCollection } from "@/lib/firebase";

type PublicAsset = {
  id: string;
  code: string;
  name: string;
  category: string;
  type: string;
  brand: string;
  model: string;
  serial: string;
  status: string;
  condition: string;
  details: string;
  specs?: Record<string, string>;
  updatedAt: string;
  custodianName?: string;
  custodianDepartment?: string;
};

type PublicMovement = {
  id: string;
  type: string;
  date: string;
  note: string;
  employeeName?: string;
  department?: string;
};

export default function PublicAssetPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<PublicAsset | null>(null);
  const [history, setHistory] = useState<PublicMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !id) return;
    getRecord<PublicAsset>("assets", id).then((record) => {
      setAsset(record);
      setLoading(false);
    });
    return watchCollection<PublicMovement>(`assets/${id}/history`, setHistory);
  }, [id]);

  if (!firebaseReady) return <PublicState title="Asset registry is being connected" copy="Please try this QR code again shortly." />;
  if (loading) return <PublicState title="Loading verified asset record…" />;
  if (!asset) return <PublicState title="Asset record not found" copy="This QR label may be old or the asset has been removed." />;

  return (
    <main className="public-asset-page">
      <header className="public-topbar">
        <div className="public-brand"><ShieldCheck size={21} /><strong>AssetFlow</strong></div>
        <span><CheckCircle2 size={15} />Verified company record</span>
      </header>
      <section className="public-asset-hero">
        <div className="public-asset-icon"><Monitor size={38} /></div>
        <div>
          <span className="public-kicker">{asset.code}</span>
          <h1>{asset.name}</h1>
          <p>{asset.brand} · {asset.model}</p>
        </div>
        <span className={`public-status public-status-${asset.status.toLowerCase().replaceAll(" ", "-")}`}>{asset.status}</span>
      </section>

      <section className="public-asset-layout">
        <div>
          <article className="public-card">
            <div className="public-card-title"><PackageCheck size={18} /><div><h2>Asset description</h2><p>Identity and technical information</p></div></div>
            <div className="public-detail-grid">
              <label>Serial number<strong>{asset.serial}</strong></label>
              <label>Category<strong>{asset.category}</strong></label>
              <label>Asset type<strong>{asset.type}</strong></label>
              <label>Condition<strong>{asset.condition}</strong></label>
              {Object.entries(asset.specs ?? {}).filter(([, value]) => value).map(([key, value]) => <label key={key}>{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}<strong>{value}</strong></label>)}
            </div>
            <div className="public-spec">{asset.details || "No additional specification recorded."}</div>
          </article>

          <article className="public-card public-history-card">
            <div className="public-card-title"><History size={18} /><div><h2>Lifecycle record</h2><p>Assignment, return and repair history</p></div></div>
            <div className="public-timeline">
              {history.length ? history.sort((a, b) => b.date.localeCompare(a.date)).map((event) => (
                <div key={event.id}>
                  <span>{event.type === "Repair" ? <Wrench size={15} /> : <ArrowLeftRight size={15} />}</span>
                  <div><strong>{event.type}</strong><p>{event.employeeName || "IT Department"}{event.department ? ` · ${event.department}` : ""}</p><small>{event.note}</small></div>
                  <time>{new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
                </div>
              )) : <div className="public-empty-history"><Clock3 size={18} />No previous lifecycle events have been published.</div>}
            </div>
          </article>
        </div>

        <aside>
          <article className="public-card public-custodian">
            <div className="public-card-title"><UserRound size={18} /><div><h2>Current custodian</h2><p>Live assignment status</p></div></div>
            {asset.custodianName ? <><span className="public-avatar">{asset.custodianName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><h3>{asset.custodianName}</h3><p><Building2 size={14} />{asset.custodianDepartment}</p></> : <div className="public-stock"><PackageCheck size={22} /><strong>Available in stock</strong><span>This item is currently under IT custody.</span></div>}
          </article>
          <article className="public-verification">
            <ShieldCheck size={22} />
            <div><strong>Live record</strong><p>Details update automatically when the asset is assigned, returned or repaired.</p></div>
          </article>
          <p className="public-updated">Last updated · {new Date(asset.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </aside>
      </section>
    </main>
  );
}

function PublicState({ title, copy }: { title: string; copy?: string }) {
  return <main className="public-state"><div><ShieldCheck size={30} /><h1>{title}</h1>{copy && <p>{copy}</p>}</div></main>;
}
