'use client';
import { Spark } from './charts';
import styles from './mini-history.module.css';
export function MiniHistory({
  values,
  label,
}: {
  values: (number | null)[];
  label: string;
}) {
  return (
    <div className={styles.history} aria-label={label} title={label}>
      <Spark values={values} />
      <small>{label}</small>
    </div>
  );
}
