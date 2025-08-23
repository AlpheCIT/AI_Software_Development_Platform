// ArangoDB Database Schema for Technical Debt Analysis
// This script initializes the collections and indexes needed for storing technical debt data

const collections = [
  {
    name: 'technical_debt_analyses',
    type: 'document',
    description: 'Stores complete technical debt analysis results'
  },
  {
    name: 'debt_hotspots',
    type: 'document', 
    description: 'Stores individual file debt analysis results'
  },
  {
    name: 'debt_trends',
    type: 'document',
    description: 'Stores daily aggregated trend data'
  },
  {
    name: 'debt_recommendations',
    type: 'document',
    description: 'Stores generated recommendations and their status'
  }
];

const indexes = [
  // Technical Debt Analyses indexes
  {
    collection: 'technical_debt_analyses',
    fields: ['analysis_date'],
    type: 'persistent',
    name: 'idx_analysis_date'
  },
  {
    collection: 'technical_debt_analyses',
    fields: ['project_id', 'analysis_date'],
    type: 'persistent', 
    name: 'idx_project_analysis_date'
  },
  
  // Debt Hotspots indexes
  {
    collection: 'debt_hotspots',
    fields: ['analysis_id'],
    type: 'persistent',
    name: 'idx_hotspot_analysis'
  },
  {
    collection: 'debt_hotspots',
    fields: ['file_path'],
    type: 'persistent',
    name: 'idx_hotspot_file_path'
  },
  {
    collection: 'debt_hotspots',
    fields: ['debt_score'],
    type: 'persistent',
    name: 'idx_hotspot_debt_score'
  },
  {
    collection: 'debt_hotspots',
    fields: ['analysis_date'],
    type: 'persistent',
    name: 'idx_hotspot_analysis_date'
  },
  
  // Debt Trends indexes
  {
    collection: 'debt_trends',
    fields: ['date'],
    type: 'persistent',
    name: 'idx_trends_date'
  },
  {
    collection: 'debt_trends',
    fields: ['project_id', 'date'],
    type: 'persistent',
    name: 'idx_trends_project_date'
  },
  
  // Debt Recommendations indexes
  {
    collection: 'debt_recommendations',
    fields: ['analysis_id'],
    type: 'persistent',
    name: 'idx_recommendations_analysis'
  },
  {
    collection: 'debt_recommendations',
    fields: ['status'],
    type: 'persistent',
    name: 'idx_recommendations_status'
  },
  {
    collection: 'debt_recommendations',
    fields: ['priority'],
    type: 'persistent',
    name: 'idx_recommendations_priority'
  }
];

module.exports = {
  collections,
  indexes
};
