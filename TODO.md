# TODO - Migração Netlify → Node.js/Express + PM2/Nginx

## ✅ Plano Aprovado
- [x] Analisar funções Netlify
- [x] Analisar frontend (checkout.html)
- [x] Criar plano detalhado
- [x] Usuário aprovou

## 🔄 Implementação Backend (backend/)
- [x] 1. Criar package.json + .env.example + .gitignore
- [ ] 4. Criar routes/transactions.js (create + get)
- [ ] 5. Criar routes/webhook.js (com dedup melhorado)
- [ ] 6. Criar routes/utmify.js (token via env)
- [ ] 7. Criar ecosystem.config.js (PM2)

## 🔄 Ajustes Frontend
- [ ] 8. Editar checkout.html (trocar URLs /api/)

## 🔄 Deploy VPS
- [ ] 9. nginx.conf.example
- [ ] 10. pm2-deploy.sh
- [ ] 11. Teste local + attempt_completion

**Status:** Iniciando backend...
