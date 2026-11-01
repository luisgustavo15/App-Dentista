# PRD — Clínica Odontológica Dr. Jocélio

## Visão geral
App mobile (Expo/React Native) para a clínica odontológica do Dr. Jocélio, com área do paciente e painel administrativo em um único app.

## Autenticação
- Google OAuth via Emergent Auth (zero chave externa).
- Papel atribuído no login: `admin` se email estiver em `backend/.env:ADMIN_EMAILS`, senão `patient`.
- Token salvo em `expo-secure-store` (mobile) / `localStorage` (web).

## Funcionalidades (paciente)
- Home com saudação, próxima consulta, atalhos (Serviços, Equipe, Galeria, Contato), carrossel de serviços, destaque do Dr. Jocélio.
- Fluxo de agendamento: serviço → dentista → data (14 dias) → horário (slots gerados server-side, exclusão de reservados) → observações → confirmação.
- Lista de consultas (segmentada em "Próximas" / "Histórico") com cancelamento.
- Catálogo de serviços, página da equipe, galeria antes/depois.
- Contato: WhatsApp, telefone, e-mail, abrir Google Maps.
- Perfil com avatar, dados Google e logout.

## Funcionalidades (admin)
- Tab exclusiva "Admin" (oculta para pacientes).
- Dashboard de estatísticas (hoje, pendentes, confirmadas, pacientes).
- Lista de todos os agendamentos com filtros (Todas / Pendentes / Confirmadas / Concluídas / Canceladas).
- Ações: Confirmar / Concluir / Cancelar.

## Backend (FastAPI + Motor + MongoDB)
- `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/profile`
- `/api/services`, `/api/dentists`, `/api/gallery`, `/api/clinic`
- `/api/appointments/available-slots`, `/api/appointments`, `/api/appointments/mine`, `/api/appointments/{id}` (DELETE)
- `/api/admin/appointments`, `/api/admin/appointments/{id}`, `/api/admin/stats`
- Seed automático na inicialização (8 serviços, 3 dentistas, 3 cases antes/depois).

## Design
- Azul odontológico clássico (`#1A73E8`) com toques modernos (Plus Jakarta Sans, cantos arredondados, espaçamento generoso).
- 4 tabs: Início / Consultas / Admin (condicional) / Perfil.

## Idioma
- Português (Brasil) em toda a interface.

## Status
- Backend: 23/23 testes passando (testing agent).
- Frontend: tela de login validada visualmente.
