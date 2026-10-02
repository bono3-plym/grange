import type { AuthUser } from "../shared/auth";
import { rebindAuth, setAuthToken } from "./socket";
import { useGameStore } from "./store";

export interface AuthResponse {
	ok: boolean;
	error?: string;
	user?: AuthUser;
	token?: string;
}

async function post(
	path: string,
	body: unknown,
): Promise<{ status: number; data: AuthResponse }> {
	const res = await fetch(`/api/auth${path}`, {
		method: "POST",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, data: await res.json() };
}

function accept(data: AuthResponse): AuthResponse {
	if (data.ok && data.user) {
		useGameStore.getState().setUser(data.user);
		setAuthToken(data.token ?? null);
		rebindAuth();
	}
	return data;
}

export async function register(input: {
	username: string;
	email: string;
	password: string;
}): Promise<AuthResponse> {
	return accept((await post("/register", input)).data);
}

export async function login(input: {
	username: string;
	password: string;
}): Promise<AuthResponse> {
	return accept((await post("/login", input)).data);
}

export async function logout(): Promise<void> {
	await post("/logout", {});
	useGameStore.getState().clearUser();
	setAuthToken(null);
	rebindAuth();
}

/** Resolves the session on page load. Returns null when there is no valid session. */
export async function fetchMe(): Promise<AuthUser | null> {
	const res = await fetch("/api/auth/me", { credentials: "same-origin" });
	if (!res.ok) {
		useGameStore.getState().clearUser();
		setAuthToken(null);
		return null;
	}
	const { user, token } = (await res.json()) as {
		user: AuthUser;
		token: string;
	};
	useGameStore.getState().setUser(user);
	setAuthToken(token);
	rebindAuth();
	return user;
}
