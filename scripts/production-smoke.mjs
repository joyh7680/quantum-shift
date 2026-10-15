// Run the same user-facing menu flow against the production build.
process.env.QC_QA_URL ||= 'http://127.0.0.1:4173/';
process.env.QC_QA_PRODUCTION = '1';
await import('./menu-smoke.mjs');
