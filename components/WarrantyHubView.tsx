"use client";

import { ArrowLeft, BadgeCheck, Clock3, Package, Wrench } from "lucide-react";

export function WarrantyHubView({
  onBackToDashboard,
  onViewAssets,
}: {
  onBackToDashboard: () => void;
  onViewAssets: () => void;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">WARRANTY &amp; COVERAGE</span>
          <h1>Warranty Tracker</h1>
          <p>Manufacturer warranty status, coverage dates, and repair claim eligibility.</p>
        </div>
      </div>

      <section className="panel under-dev-panel">
        <div className="under-dev-icon">
          <Wrench size={28} />
        </div>
        <span className="dev-stage-pill">
          <Clock3 size={13} />Under Development
        </span>
        <h2>This feature is still under development</h2>
        <p>
          The Warranty Tracker module (warranty start/end dates, expiry alerts, and manufacturer warranty lookup) is currently in the development stage and will be enabled in a future update.
        </p>
        <div className="under-dev-roadmap">
          <div><BadgeCheck size={15} /><span>Warranty start &amp; end date tracking for IT assets</span></div>
          <div><BadgeCheck size={15} /><span>Automatic Under Warranty / Expiring Soon / Expired status</span></div>
          <div><BadgeCheck size={15} /><span>Bulk vendor &amp; serial warranty check tools</span></div>
        </div>
        <div className="under-dev-actions">
          <button type="button" className="button button-secondary" onClick={onBackToDashboard}>
            <ArrowLeft size={16} />Back to Dashboard
          </button>
          <button type="button" className="button button-primary" onClick={onViewAssets}>
            <Package size={16} />Open IT Assets
          </button>
        </div>
      </section>
    </>
  );
}
