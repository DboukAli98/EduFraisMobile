import { useAppSelector } from '../../src/store/store';
import MerchandiseScreen from '../../src/screens/parent/MerchandiseScreen';
import MerchandiseManageScreen from '../../src/screens/director/MerchandiseManageScreen';

export default function MerchandiseRoute() {
  const role = useAppSelector((state) => state.auth.user?.role);

  if (role === 'director') {
    return <MerchandiseManageScreen />;
  }

  return <MerchandiseScreen />;
}
