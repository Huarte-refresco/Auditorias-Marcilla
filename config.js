/* Configuración de la app. Rellénala con los datos de tu proyecto de Supabase
   (Project Settings → API). La clave "anon / publishable" es pública por diseño:
   lo que protege los datos son las reglas de seguridad del esquema SQL.
   NUNCA pegues aquí la clave "service_role" ni la "secret". */
window.AUD_CONFIG = {
  supabaseUrl: "https://deftwlqcmobaeetkivvw.supabase.co",
  supabaseKey: "sb_publishable_5WvHd1xW_4KJ4PlPs9Tyhg_whSFrlab",

  // false (recomendado al empezar): la app prepara el correo y «Abrir en mi correo» te lleva a Outlook para enviarlo tú.
  // true: la app envía los avisos sola con la función "aviso" (Brevo); requiere el paso 6 de la guía.
  avisosPorCorreo: false,

  // Respaldo de actualización automática (segundos). Normalmente se actualiza al instante por tiempo real.
  pollSeconds: 60
};

