import { isPhil } from '../../core/variant';
import SaleNewClassic from '../../screens/SaleNewClassic';
import SaleNewPhil from '../../screens/SaleNewPhil';

/** The closed test build keeps its new showcase screen. The Phil build picks a room and a template. */
export default function NewSale() {
  return isPhil() ? <SaleNewPhil /> : <SaleNewClassic />;
}
