import { StytchProvider } from "@stytch/react";
import { StytchUIClient } from "@stytch/vanilla-js";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { Authenticate, Authorize, Login, Logout } from "./Auth.tsx";
import TodoEditor from "./Todos.tsx";

const stytch = new StytchUIClient(import.meta.env.VITE_STYTCH_PUBLIC_TOKEN ?? "", {
	endpointOptions: {
		testApiDomain: import.meta.env.VITE_STYTCH_DOMAIN,
	},
});

function App() {
	return (
		<StytchProvider stytch={stytch}>
			<main>
				<h1>TODO App MCP Demo</h1>
				<Router>
					<Routes>
						<Route path="/oauth/authorize" element={<Authorize />} />
						<Route path="/login" element={<Login />} />
						<Route path="/authenticate" element={<Authenticate />} />
						<Route path="/todoapp" element={<TodoEditor />} />
						<Route path="*" element={<Navigate to="/todoapp" />} />
					</Routes>
				</Router>
			</main>
			<footer>
				<Logout />
			</footer>
		</StytchProvider>
	);
}

export default App;
