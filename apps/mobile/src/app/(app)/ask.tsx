import { useI18n } from "../../i18n";
import { ComingSoon } from "../../ui/ComingSoon";

export default function AskScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t("bar.ask")} />;
}
