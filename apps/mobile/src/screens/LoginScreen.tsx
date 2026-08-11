import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { login } from "../api/client";
import { saveAccessToken } from "../auth/session";

type Props = {
  onLoggedIn: (email: string) => void;
};

export function LoginScreen({ onLoggedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      await saveAccessToken(result.access_token);
      onLoggedIn(result.user.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bejelentkezés sikertelen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Winunio</Text>
      <Text style={styles.subtitle}>Páros vitaplatform</Text>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Jelszó"
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => void handleLogin()}
        disabled={loading || !email.trim() || !password}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Bejelentkezés</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#4a4a4a",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#b00020",
    marginBottom: 8,
  },
});
