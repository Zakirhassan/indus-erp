import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../context/AuthContext";
import { FieldProvider } from "../context/FieldContext";
import { DayCloseGate } from "../components/DayCloseGate";
import { Icon, type IconName } from "../components/Icon";
import { LoginScreen } from "../screens/LoginScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { CollectionHubScreen } from "../screens/CollectionHubScreen";
import { AddCollectionScreen } from "../screens/AddCollectionScreen";
import { SalesHomeScreen } from "../screens/SalesHomeScreen";
import { NewSaleScreen } from "../screens/NewSaleScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { CustomersScreen } from "../screens/CustomersScreen";
import { CustomerDetailScreen } from "../screens/CustomerDetailScreen";
import { colors } from "../theme";

export type DashboardStackParamList = {
  DashboardHome: undefined;
  CustomerDetail: { customerId: string };
};

export type CollectionStackParamList = {
  CollectionHub: undefined;
  AddCollection: { fieldId: string; batchId?: string };
};

export type SalesStackParamList = {
  SalesHome: undefined;
  NewSale: undefined;
};

export type CustomersStackParamList = {
  CustomersHome: undefined;
  CustomerDetail: { customerId: string };
};

export type MainTabParamList = {
  DashboardTab: undefined;
  CollectionTab: undefined;
  CustomersTab: undefined;
  SalesTab: undefined;
  ProfileTab: undefined;
};

const DashboardStackNav = createNativeStackNavigator<DashboardStackParamList>();
const CollectionStackNav = createNativeStackNavigator<CollectionStackParamList>();
const SalesStackNav = createNativeStackNavigator<SalesStackParamList>();
const CustomersStackNav = createNativeStackNavigator<CustomersStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function DashboardStack() {
  return (
    <DashboardStackNav.Navigator screenOptions={{ headerShown: false }}>
      <DashboardStackNav.Screen name="DashboardHome" component={DashboardScreen} />
      <DashboardStackNav.Screen name="CustomerDetail" component={CustomerDetailScreen} />
    </DashboardStackNav.Navigator>
  );
}

function CustomersStack() {
  return (
    <CustomersStackNav.Navigator screenOptions={{ headerShown: false }}>
      <CustomersStackNav.Screen name="CustomersHome" component={CustomersScreen} />
      <CustomersStackNav.Screen name="CustomerDetail" component={CustomerDetailScreen} />
    </CustomersStackNav.Navigator>
  );
}

function CollectionStack() {
  return (
    <CollectionStackNav.Navigator screenOptions={{ headerShown: false }}>
      <CollectionStackNav.Screen name="CollectionHub" component={CollectionHubScreen} />
      <CollectionStackNav.Screen name="AddCollection" component={AddCollectionScreen} />
    </CollectionStackNav.Navigator>
  );
}

function SalesStack() {
  return (
    <SalesStackNav.Navigator screenOptions={{ headerShown: false }}>
      <SalesStackNav.Screen name="SalesHome" component={SalesHomeScreen} />
      <SalesStackNav.Screen name="NewSale" component={NewSaleScreen} />
    </SalesStackNav.Navigator>
  );
}

const TAB_ICON: Record<keyof MainTabParamList, { active: IconName; inactive: IconName; label: string }> = {
  DashboardTab: { active: "home", inactive: "home-outline", label: "Dashboard" },
  CollectionTab: { active: "wallet", inactive: "wallet-outline", label: "Collection" },
  CustomersTab: { active: "people", inactive: "people-outline", label: "Customers" },
  SalesTab: { active: "receipt", inactive: "receipt-outline", label: "Sales" },
  ProfileTab: { active: "person-circle", inactive: "person-circle-outline", label: "Profile" },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.action,
        tabBarInactiveTintColor: colors.inkVariant,
        tabBarStyle: { height: 58, paddingTop: 10, paddingBottom: 10, borderTopColor: colors.border },
        tabBarAccessibilityLabel: TAB_ICON[route.name].label,
        tabBarIcon: ({ focused, color }) => (
          <Icon name={focused ? TAB_ICON[route.name].active : TAB_ICON[route.name].inactive} size={24} color={color} />
        ),
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardStack} />
      <Tab.Screen name="CollectionTab" component={CollectionStack} />
      <Tab.Screen name="CustomersTab" component={CustomersStack} />
      <Tab.Screen name="SalesTab" component={SalesStack} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <FieldProvider>
      <DayCloseGate>
        <MainTabs />
      </DayCloseGate>
    </FieldProvider>
  );
}
