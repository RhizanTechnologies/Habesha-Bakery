'use client';

import React from 'react';
import Link from 'next/link';
import { Wheat, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function StockPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </Link>

      <div className="bg-white border-2 border-amber-300 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
          <Wheat className="w-3.5 h-3.5" />
          DEVELOPER 1 &bull; BACK-OF-HOUSE
        </div>

        <h1 className="text-2xl font-black text-slate-900 mt-4">
          Raw Material Inventory &amp; Warehouse Ingestion
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Warehouse tracking for flour bags, yeast, salt, oil, and packaging materials.
        </p>

        <div className="mt-6 p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900">Developer 1 Task Checklist:</h2>
          <ul className="space-y-2 text-xs text-amber-900">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Model: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">RawMaterial</code> (name, unit, currentQuantity, minStockThreshold)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Model: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">RawStockMovement</code> (materialId, type: INTAKE | DEDUCTION, quantity, reason)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Endpoint: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">POST /api/stock/intake</code> (Receive flour bags into Central Hub warehouse)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
