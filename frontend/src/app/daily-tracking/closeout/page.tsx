'use client';

import React from 'react';
import Link from 'next/link';
import { CircleDollarSign, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function CloseoutPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </Link>

      <div className="bg-white border-2 border-teal-300 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
          <CircleDollarSign className="w-3.5 h-3.5" />
          DEVELOPER 2 &bull; FRONT-OF-HOUSE
        </div>

        <h1 className="text-2xl font-black text-slate-900 mt-4">
          Continuous Evening Closeout &amp; Cash Reconciliation
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Zero-lockout daily workflow tracking. Cash counting arithmetic, digital payments reconciliation, and variance tracking.
        </p>

        <div className="mt-6 p-4 rounded-xl bg-teal-50/60 border border-teal-200/60 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-teal-900">Developer 2 Task Checklist:</h2>
          <ul className="space-y-2 text-xs text-teal-900">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Model: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-teal-200">DailyCashTracking</code> (branchId, businessDate, startingFloat, totalCashSales, totalDigitalSales, totalExpenses, actualCountedCash, variance)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Formulas from Koket legacy service: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-teal-200">expectedCash = startingFloat + totalCashSales - totalExpenses</code></span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Variance Formula: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-teal-200">variance = actualCountedCash - expectedCash</code></span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Endpoint: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-teal-200">POST /api/daily-tracking/closeout</code> (Submits daily cash count without locking cashier out)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
