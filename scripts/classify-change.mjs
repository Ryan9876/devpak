const paths = process.argv.slice(2).filter(Boolean);
if (!paths.length) {
  console.log(JSON.stringify({tier:'full', reason:'No paths supplied; safest default is full validation.'}, null, 2));
  process.exit(0);
}
const is = (re) => paths.some((p) => re.test(p));
let tier='ui';
let reason='Presentation/client-shell change.';
if (is(/^(supabase\/|src\/lib\/supabase\/|src\/app\/auth\/|src\/app\/api\/health\/|\.env\.example$|proxy\.ts$)/)) {
  tier='backend'; reason='Persistence/auth/schema boundary changed.';
} else if (is(/^(src\/lib\/room-model\/|src\/lib\/planning\/|src\/app\/api\/ai\/|tests\/domain|scripts\/validate-room-model)/)) {
  tier='domain'; reason='Room Model/planning/safety logic changed.';
} else if (is(/^(package\.json|tsconfig|next-env|PROJECT-CONSTITUTION|ARCHITECTURE)/)) {
  tier='full'; reason='Build/runtime/architecture contract changed.';
}
const commands = {
  ui:['npm run validate:ui'],
  domain:['npm run validate:domain','npm run build'],
  backend:['npm run validate:full','Supabase migration/advisor checks','live backend health + auth/persistence smoke'],
  full:['npm run validate:full']
};
console.log(JSON.stringify({tier, reason, paths, commands:commands[tier]}, null, 2));
