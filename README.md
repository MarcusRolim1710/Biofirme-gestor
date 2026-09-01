# Biofirme Gestor

Sistema de gestão Biofirme — cadastro de funcionários e dashboard.

> **🚀 Deploy na Vercel**
> Este repositório está configurado para deploy automático na **Vercel**.
> A cada push na branch \main\, a Vercel faz o build e deploy automaticamente.
> Projeto: \Biofirme-gestor\

## Stack
- HTML / CSS / JavaScript (vanilla)
- Supabase (Auth + Database)
- GSAP para animações

## Como rodar localmente
\\\ash
npm install
# configure as variáveis no .env (ver .env.example)
npx serve .
\\\

## Deploy na Vercel
1. Importe o repositório \MarcusRolim1710/Biofirme-gestor\ na Vercel
2. Configure as variáveis de ambiente:
   - \SUPABASE_URL\
   - \SUPABASE_PUBLISHABLE_KEY\
3. Deploy automático a cada push em \main\

## Estrutura
- \index.html\ — Login
- \dashboard.html\ — Dashboard principal
- \js/\ — Lógica e integração Supabase
- \css/\ — Estilos

---
Desenvolvido por Marcus Rolim
