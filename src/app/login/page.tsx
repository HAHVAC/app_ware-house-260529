"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form
        action={formAction}
        className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-center">Quản lý Kho</h1>
        <p className="text-sm text-gray-500 text-center">Đăng nhập hệ thống</p>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="username">Tài khoản</label>
          <input
            id="username" name="username" autoComplete="username"
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">Mật khẩu</label>
          <input
            id="password" name="password" type="password" autoComplete="current-password"
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        {state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <button
          type="submit" disabled={pending}
          className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-60"
        >
          {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
