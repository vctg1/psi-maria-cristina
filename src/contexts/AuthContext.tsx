'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Papel = 'psicologa' | 'paciente';

export type Usuario = {
  id: string;
  papel: Papel;
  pacienteId?: string;
};

export type LoginResultado =
  | { ok: true; usuario: Usuario }
  | { ok: false; status: number; mensagem: string };

type AuthContextValor = {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<LoginResultado>;
  logout: () => Promise<void>;
  recarregar: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValor | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/validate');
      if (response.ok) {
        const dados = await response.json();
        setUsuario(dados.usuario as Usuario);
      } else {
        setUsuario(null);
      }
    } catch {
      setUsuario(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const login = useCallback(async (email: string, senha: string): Promise<LoginResultado> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          mensagem: dados?.error ?? 'Não foi possível entrar. Tente novamente.',
        };
      }
      setUsuario(dados.usuario as Usuario);
      return { ok: true, usuario: dados.usuario as Usuario };
    } catch {
      return { ok: false, status: 0, mensagem: 'Não foi possível entrar. Tente novamente.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUsuario(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout, recarregar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValor {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
