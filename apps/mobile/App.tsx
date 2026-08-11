import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { fetchMe } from "./src/api/client";
import { clearAccessToken, loadAccessToken } from "./src/auth/session";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";

type AppState =
  | { phase: "loading" }
  | { phase: "login" }
  | { phase: "home"; email: string };

export default function App() {
  const [state, setState] = useState<AppState>({ phase: "loading" });

  useEffect(() => {
    void (async () => {
      const token = await loadAccessToken();
      if (!token) {
        setState({ phase: "login" });
        return;
      }
      try {
        const me = await fetchMe(token);
        setState({ phase: "home", email: me.user.email });
      } catch {
        await clearAccessToken();
        setState({ phase: "login" });
      }
    })();
  }, []);

  async function handleLogout() {
    await clearAccessToken();
    setState({ phase: "login" });
  }

  if (state.phase === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6F8F72" />
        <StatusBar style="dark" />
      </View>
    );
  }

  if (state.phase === "login") {
    return (
      <>
        <LoginScreen
          onLoggedIn={(email) => setState({ phase: "home", email })}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  return (
    <>
      <HomeScreen email={state.email} onLogout={() => void handleLogout()} />
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});
