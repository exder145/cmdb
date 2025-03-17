/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { Card, Spin } from 'antd';
import styles from './index.module.css';

function StatisticCard({ title, value, icon, iconBackground, description, loading }) {
  return (
    <Card className={styles.statisticCard} bordered={false}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>{title}</div>
        <div className={styles.cardIcon} style={{ backgroundColor: iconBackground }}>
          {icon}
        </div>
      </div>
      <div className={styles.cardContent}>
        {loading ? (
          <Spin size="small" />
        ) : (
          <>
            <div className={styles.cardValue}>{value}</div>
            <div className={styles.cardDescription}>{description}</div>
          </>
        )}
      </div>
    </Card>
  );
}

export default StatisticCard;
