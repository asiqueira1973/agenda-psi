-- Teste — telefone_e164: o formato que a Bird aceita (0019).
begin;
select plan(9);
select is(public.telefone_e164('11 91234-5678'), '+5511912345678', 'DDD + celular sem 55 ganha +55');
select is(public.telefone_e164('+55 (11) 91234-5678'), '+5511912345678', 'já certo, só limpa');
select is(public.telefone_e164('55 011 91234-5678'), '+5511912345678', 'zero de discagem depois do 55 sai');
select is(public.telefone_e164('011 91234-5678'), '+5511912345678', 'zero de discagem sai');
select is(public.telefone_e164('+47 99123-4567'), '+5547991234567', 'DDD 47 com + não vira Noruega');
select is(public.telefone_e164('+39 333 123 4567'), '+393331234567', 'estrangeiro com + fica');
select is(public.telefone_e164('91234-5678'), null, 'sem DDD fica de fora');
select is(public.telefone_e164('+55 21 99999-99999'), null, 'dígito a mais fica de fora');
select is(public.telefone_e164(null), null, 'nulo é nulo');
select * from finish();
rollback;
