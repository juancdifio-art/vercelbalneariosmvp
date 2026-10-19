import { useEffect } from 'react';
import { idDelChat, mostrarChat, actualizarChat, ocultarChat } from '../lib/chatSoporte';

const ID_CONFIGURADO = idDelChat(import.meta.env.VITE_TAWK_ID);

/**
 * Burbuja de chat de soporte mientras hay sesion. Quien atiende ve el
 * establecimiento, el mail y la pantalla desde la que le escriben.
 * Al cerrar sesion (el shell se desmonta) la burbuja se oculta.
 */
export default function useChatSoporte({ email, establecimiento, pantalla }, id = ID_CONFIGURADO) {
  useEffect(() => {
    if (!id) return undefined;
    mostrarChat(id, { name: establecimiento || email, email, establecimiento });
    return () => ocultarChat();
  }, [id, email, establecimiento]);

  useEffect(() => {
    if (id && pantalla) actualizarChat({ pantalla });
  }, [id, pantalla]);
}
