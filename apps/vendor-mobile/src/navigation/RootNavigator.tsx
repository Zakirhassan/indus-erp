import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { FieldProvider } from "../context/FieldContext";
import { LoginScreen } from "../screens/LoginScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { AddCollectionScreen } from "../screens/AddCollectionScreen";
import { NewSaleScreen } from "../screens/NewSaleScreen";
import { TodaysSalesScreen } from "../screens/TodaysSalesScreen";
import { CustomersScreen } from "../screens/CustomersScreen";
import { CustomerDetailScreen } from "../screens/CustomerDetailScreen";

export type RootStackParamList = {
  Dashboard: undefined;
  AddCollection: undefined;
  NewSale: undefined;
  TodaysSales: undefined;
  Customers: undefined;
  CustomerDetail: { customerId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <FieldProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="AddCollection" component={AddCollectionScreen} />
        <Stack.Screen name="NewSale" component={NewSaleScreen} />
        <Stack.Screen name="TodaysSales" component={TodaysSalesScreen} />
        <Stack.Screen name="Customers" component={CustomersScreen} />
        <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      </Stack.Navigator>
    </FieldProvider>
  );
}
