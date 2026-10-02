import { Route, Routes } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import Login from "./routes/Login";
import RequireAuth from "./routes/RequireAuth";
import FarmMap from "./world/FarmMap";

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<Login />} />
			<Route
				path="/world"
				element={
					<RequireAuth>
						<FarmMap />
					</RequireAuth>
				}
			/>
			<Route
				path="/farms/:owner"
				element={
					<RequireAuth>
						<FarmMap />
					</RequireAuth>
				}
			/>
			<Route
				path="/dashboard"
				element={
					<RequireAuth>
						<Dashboard />
					</RequireAuth>
				}
			/>
		</Routes>
	);
}
