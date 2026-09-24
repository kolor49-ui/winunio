import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  email: string;
  onLogout: () => void;
};

export function HomeScreen({ email, onLogout }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Winunio</Text>
      <Text style={styles.email}>{email}</Text>
      <Text style={styles.hint}>
        Android app v0.1 — bejelentkezés működik.{"\n"}
        Viták, vitázás és folytatáskérés (TOTP) következik.
      </Text>
      <Pressable style={styles.button} onPress={onLogout}>
        <Text style={styles.buttonText}>Kijelentkezés</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: "#444",
    marginBottom: 24,
  },
  hint: {
    fontSize: 15,
    lineHeight: 22,
    color: "#666",
    marginBottom: 32,
  },
  button: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    fontSize: 15,
    color: "#333",
  },
});
