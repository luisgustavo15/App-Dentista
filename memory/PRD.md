# PRD — Clínica Odontológica Dr. Jocélio

## Visão geral
App mobile (Expo/React Native) para a clínica odontológica do Dr. Jocélio, com área do paciente e painel administrativo em um único app.

## Autenticação (atualizado — login Google removido a pedido do usuário)
- Pacientes: cadastro e login com e-mail + senha (bcrypt, JWT de 7 dias).
- Admin: apenas uma senha de acesso (`ADMIN_ACCESS_PASSWORD` em backend/.env), via link "Sou da clínica".
- Limite de 5 tentativas erradas por IP real (X-Forwarded-For) em 15 min.
- Token salvo em secure storage (mobile) / localStorage (web); cache limpo ao sair.

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
- `/api/auth/register`, `/api/auth/login`, `/api/auth/admin-login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/profile`
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

## Histórico
- v1: MVP com login Google.
- v2: Login Google trocado por e-mail/senha + senha de admin; horários respeitam expediente (Seg–Sex 08–19, Sáb 09–13, sem domingo, sem horários passados); erro de agendamento exibido na tela.

## Backlog
- P1: Dados reais da clínica (endereço, telefones, preços, fotos)
- P1: Recuperação de senha por e-mail
- P2: Ocultar fluxo de agendamento para a conta admin; lembretes por WhatsApp; prontuário digital
