/**
 * Compare two objects and return an array of changes.
 * @param {Object} original - The original object.
 * @param {Object} updated - The updated object.
 * @param {string[]} [arrayKeys=[]] - Keys to treat as arrays of objects (e.g., 'fields').
 * @returns {Array} An array of changes.
 */
function getChanges(original, updated, arrayKeys = []) {
    const changes = [];
  
    const formatChange = (key, oldValue, newValue) => ({
      key,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    });
  
    for (const [key, newValue] of Object.entries(updated)) {
      const oldValue = original[key];
  
      if (arrayKeys.includes(key) && Array.isArray(newValue) && Array.isArray(oldValue)) {
        const fieldChanges = [];
  
        const maxLength = Math.max(oldValue.length, newValue.length);
  
        for (let i = 0; i < maxLength; i++) {
          const oldField = oldValue[i] ?? "";
          const newField = newValue[i] ?? "";
  
          if (oldField && !newField) {
            // Field was deleted
            fieldChanges.push({
              action: 'deleted',
              fieldName: oldField.actualName || `Field ${i + 1}`,
              details: oldField,
            });
          } else if (!oldField && newField) {
            // Field was added
            fieldChanges.push({
              action: 'added',
              fieldName: newField.actualName || `Field ${i + 1}`,
              details: newField,
            });
          } else if (oldField && newField) {
            // Field was updated
            for (const [fieldKey, newFieldValue] of Object.entries(newField)) {
              const oldFieldValue = oldField[fieldKey];
              if (JSON.stringify(oldFieldValue) != JSON.stringify(newFieldValue)) {
                fieldChanges.push({
                  action: 'updated',
                  fieldName: newField.actualName || `Field ${i + 1}`,
                  key: fieldKey,
                  oldValue: oldFieldValue ?? null,
                  newValue: newFieldValue ?? null,
                });
              }
            }
          }
        }
  
        if (fieldChanges.length > 0) {
          changes.push({
            key,
            changes: fieldChanges,
          });
        }
      } 

      else if (oldValue.toString() != newValue.toString()) {
        changes.push(formatChange(key, oldValue, newValue));
      }
    }
  
    return changes;
  }

module.exports = { getChanges };