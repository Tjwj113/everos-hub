// Convites e recuperação podem retornar à raiz pelo Site URL do Supabase.
// Encaminha apenas esses fluxos para o painel; nenhum dado é salvo aqui.
(() => {
  const parametros = new URLSearchParams(window.location.hash.slice(1));
  const tipo = parametros.get('type');
  if (tipo === 'invite' || tipo === 'recovery' || parametros.get('error_code') === 'otp_expired') {
    // Caminho relativo: funciona no domínio e também numa subpasta (ex.: GitHub Pages).
    window.location.replace(`admin/${window.location.hash}`);
  }
})();
