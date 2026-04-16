# Correção: Checkout não aplica desconto progressivo do carrinho

## ✅ Plano aprovado
- [x] Identificar causa raiz (localStorage armazena preços brutos)
- [x] Criar TODO.md com steps

## ✅ Correção implementada
- [x] 1. getDiscountRate() adicionado (15%/20% tiers)
- [x] 2. subtotalRaw → discount → cartTotal calculados
- [x] 3. resumeTotal mostra R$251,43 (exemplo)
- [x] 4. PIX 10% sobre total já descontado
- [x] 5. Parcelas baseadas em finalTotal
- [x] 6. Pagou payloads com preços descontados
- [x] 7. Logs de debug no console

## 🧪 Testar
- [ ] Checkout reflete desconto do carrinho
- [ ] PIX/Card usam valores corretos  
- [ ] Console mostra debug correto

**Status:** ✅ Concluído | Aguardando teste

## 🧪 Testar
- [ ] Checkout reflete R$251,43 (exemplo)
- [ ] PIX/card usam valor correto
- [ ] UTMify recebe preços com desconto

**Status:** Em progresso
