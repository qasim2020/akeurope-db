const { getOrderIcon, slugToString } = require('../modules/helpers');

const logTemplates = ({ type, entity, actor, project, file, order, entry, color, customer, changes, message }) => {
    if (!type || !entity || !actor) {
        throw new Error('Missing required parameters: type, entity, and actor are mandatory.');
    }

    const commons = (entityType, entityId) => ({
        entityType,
        entityId,
        actorType: 'user',
        actorId: actor._id,
    });

    const templates = {
        login: {
            ...commons('user', entity._id),
            action: `<a href="/user/${entity._id}">${entity.name}</a> logged in`,
            color: 'grey',
        },
        logout: {
            ...commons('user', entity._id),
            action: `<a href="/user/${entity._id}">${entity.name}</a> logged out`,
            color: 'grey',
        },
        passwordChanged: {
            ...commons('user', entity._id),
            action: `Password changed of <a href="/user/${entity._id}">${entity.name}</a>`,
            isNotification: true,
            color: 'grey',
        },
        sentEmailForgotPassword: {
            ...commons('user', entity._id),
            action: `Sent forgot password email to <a href="/user/${entity._id}">${entity.name}</a>`,
            isNotification: true,
            color: 'grey',
        },
        customerCreated: {
            ...commons('customer', entity._id),
            action: `Customer <a href="/customer/${entity._id}">${entity.name}</a> created`,
            color: 'blue',
            isNotification: true,
        },
        customerUpdated: changes
            ? {
                ...commons('customer', entity._id),
                action: `Customer <a href="/customer/${entity._id}">${entity.name}</a> updated`,
                changes,
                color: 'blue',
            }
            : null,
        sentEmailCustomerInvite: {
            ...commons('customer', entity._id),
            action: `Sent customer invite email to <a href="/customer/${entity._id}">${entity.name}</a>`,
            color: 'blue',
            isNotification: false,
        },
        projectCreated: {
            ...commons('project', entity._id),
            action: `Project <a href="/project/${entity.slug}">${entity.name}</a> created`,
            color: 'blue',
        },
        projectUpdated: changes
            ? {
                ...commons('project', entity._id),
                action: `Project <a href="/project/${entity.slug}">${entity.name}</a> updated`,
                changes,
                color: 'blue',
            }
            : null,
        entryCreated: project
            ? {
                ...commons('entry', entity._id),
                action: `<a href="/entry/${entity._id}/project/${project.slug}">${entity.name || entity.nameOfOrphan || 'Entry'
                    }</a> created.`,
                color: 'blue',
            }
            : null,
        entryUpdated:
            project && changes
                ? {
                    ...commons('entry', entity._id),
                    action: `<a href="/entry/${entity._id}/project/${project.slug}">${entity.name || entity.nameOfOrphan || 'Entry'
                        }</a> updated.`,
                    changes,
                    color: 'blue',
                }
                : null,
        donorEntryUpdated:
            entry && project && changes
                ? {
                    ...commons('customer', entity._id),
                    action: `<a href="/entry/${entry._id}/project/${project.slug}">${entry.name || entry.nameOfOrphan || 'Entry'
                        }</a> updated.`,
                    changes,
                    color: 'blue',
                    isNotification: true,
                    isRead: true,
                    isReadByCustomer: false,
                }
                : null,
        entryDeleted: project
            ? {
                ...commons('entry', entity._id),
                action: `Entry <a href="/entry/${entity._id}/project/${project.slug}">${entity.name || entity.nameOfOrphan
                    }</a> deleted in project <a href="/project/${project.slug}">${project.name}</a>`,
                color: 'red',
                isNotification: true,
            }
            : null,
        entryUpdatedBulkUpload:
            project && changes
                ? {
                    ...commons('entry', entity._id),
                    action: `<a href="/entry/${entity._id}/project/${project.slug}">${entity.name || entity.nameOfOrphan || 'Entry'
                        }</a> updated in bulk upload.`,
                    changes,
                    color: 'blue',
                }
                : null,
        entryCreatedBulkUpload: project
            ? {
                ...commons('entry', entity._id),
                action: `<a href="/entry/${entity._id}/project/${project.slug}">${entity.name || entity.nameOfOrphan || 'Entry'
                    }</a> created in bulk upload.`,
                isNotification: false,
                color: 'blue',
            }
            : null,
        bulkUploadCompleted: {
            ...commons('project', entity._id),
            action: `Bulk upload completed in project <a href="/project/${entity.slug}">${entity.name}</a>`,
            changes,
            color: 'blue',
            isNotification: true,
        },
        userCreated: {
            ...commons('user', entity._id),
            action: `New administrator <a href="/user/${entity._id}">${entity.name}</a> created`,
            color: 'blue',
        },
        userUpdated: {
            ...commons('user', entity._id),
            action: `Administrator <a href="/user/${entity._id}">${entity.name}</a> updated`,
            changes,
            color: 'blue',
        },
        userDeleted: {
            ...commons('user', entity._id),
            action: `Administrator <a href="/user/${entity._id}">${entity.name}</a> deleted`,
            color: 'red',
            isNotification: true,
        },
        userAcceptedInvite: {
            ...commons('user', entity._id),
            action: `Administrator <a href="/user/${entity._id}">${entity.name}</a> accepted invite`,
            color: 'green',
            isNotification: true,
        },
        sentEmailUserInvite: {
            ...commons('user', entity._id),
            action: `Sent email invite to adminstrator <a href="/user/${entity._id}">${entity.name}</a>`,
            color: 'blue',
            isNotification: true,
        },
        // NEW CHANGES FROM 31 DEC 2024
        orderCreated: {
            ...commons('order', entity._id),
            action: `New <a href="/order/${entity._id}">Order-${entity.orderNo}</a> created`,
            color: 'green',
            isNotification: true,
            isRead: true,
            isReadByCustomer: false,
        },
        customerRemovedFromOrder:
            order && customer
                ? {
                    ...commons('order', entity._id),
                    action: `<a href="/customer/${customer._id}">${customer.name}</a> removed from <a href="/order/${order._id}">Order-${order.orderNo}</a>`,
                    color: 'blue',
                }
                : null,
        customerAddedToOrder:
            order && customer
                ? {
                    ...commons('order', entity._id),
                    action: `<a href="/customer/${customer._id}">${customer.name}</a> added to <a href="/order/${order._id}">Order-${order.orderNo}</a>`,
                    color: 'blue',
                }
                : null,
        entryAddedToOrder:
            order && project
                ? {
                    ...commons('order', entity._id),
                    action: `<a href="/entry/${entity._id}/project/${project.slug}">${entity.name || entity.nameOfOrphan
                        }</a> in project <a href="/project/${project.slug}">${project.detail ? project.detail.name : project.name
                        }</a> selected in <a href="/order/${order._id}">Order-${order.orderNo}</a>`,
                    changes,
                    color: 'green',
                }
                : null,
        entryRemovedFromOrder:
            order && project
                ? {
                    ...commons('order', entity._id),
                    action: `<a href="/entry/${entity._id}/project/${project.slug}">${entity.name || entity.nameOfOrphan
                        }</a> in project <a href="/project/${project.slug}">${project.detail ? project.detail.name : project.name
                        }</a> removed from <a href="/order/${order._id}">Order-${order.orderNo}</a>`,
                    changes,
                    color: 'red',
                }
                : null,
        entryOrderStatusChanged:
            order && project
                ? {
                    ...commons('order', entity._id),
                    action: `<a href="/entry/${entity._id}/project/${project.slug}">${entity.name
                        }</a> in project <a href="/project/${project.slug}">${project.detail ? project.detail.name : project.name
                        }</a> status changed in <a href="/order/${order._id}">Order-${order.orderNo}</a>`,
                    changes,
                    color: color ? color : 'blue',
                }
                : null,
        entrySubscriptionChanged:
            order && project && changes
                ? {
                    ...commons('order', entity._id),
                    action: `Subscription changed for <a href="/entry/${entity._id}/project/${project.slug}">${entity.name || entity.nameOfOrphan
                        }</a> in project <a href="/project/${project.slug}">${project.detail ? project.detail.name : project.name
                        }</a> of <a href="/order/${order._id}">Order-${order.orderNo}</a>`,
                    changes,
                    color: 'blue',
                }
                : null,
        orderEntrySubscriptionChanged:
            entry && project && changes
                ? {
                    ...commons('order', entity._id),
                    action: `Subscription changed of <a href="/entry/${entry._id}/project/${project.slug}">${entry.name || entry.nameOfOrphan
                        }</a> in <a href="/project/${project.slug}">${slugToString(project.slug)}</a> of <a href="/order/${entity._id
                        }">Order-${entity.orderNo}</a>`,
                    changes,
                    color: 'blue',
                }
                : null,
        orderColumnSubscriptionChanged:
            project && order && changes
                ? {
                    ...commons('order', entity._id),
                    action: `Subscription column changed in project <a href="/project/${project.slug}">${project.name}</a> of <a href="/order/${order._id}">Order-${order.orderNo}</a>`,
                    changes,
                    color: 'blue',
                }
                : null,
        orderCustomerChanged: {
            ...commons('order', entity._id),
            action: `Customer changed in <a href="/order/${entity._id}">Order-${entity.orderNo}</a>`,
            color: 'blue',
            changes,
        },
        orderCurrencyChanged: {
            ...commons('order', entity._id),
            action: `Currency changed in <a href="/order/${entity._id}">Order-${entity.orderNo}</a>`,
            color: 'blue',
            changes,
        },
        orderProjectRemoved:
            project && order
                ? {
                    ...commons('order', entity._id),
                    action: `Project <a href="/project/${project.slug}">${project.name}</a> removed from <a href="/order/${order._id}">Order-${order.orderNo}</a>`,
                    color: 'blue',
                }
                : null,
        orderProjectSelection: project
            ? {
                ...commons('order', entity._id),
                action: `${project.selection ? project.selection.entries.length : null
                    } x entries selected in project <a href="/project/${project.slug}">${project.name}</a> of <a href="/order/${entity._id
                    }">Order-${entity.orderNo}</a>`,
                color: 'blue',
            }
            : null,
        sponsorshipStopped: project
            ? {
                ...commons('order', entity._id),
                action: `${project.selection ? project.selection.entries.length : null
                    } x entries selected in project <a href="/project/${project.slug}">${project.name}</a> of <a href="/order/${entity._id
                    }">Order-${entity.orderNo}</a>`,
                color: 'blue',
            }
            : null,
        orderTotalCostChanged: {
            ...commons('order', entity._id),
            action: `Total cost changed in <a href="/order/${entity._id}">Order-${entity.orderNo}</a>`,
            changes,
            color: 'blue',
        },
        orderStatusChanged: {
            ...commons('order', entity._id),
            action: `Status changed in <a href="/order/${entity._id}">Order-${entity.orderNo}</a>`,
            changes,
            isNotification: true,
            isRead: true,
            isReadByCustomer: false,
            color: 'blue',
        },
        orderStatusChangedToPaid: {
            ...commons('order', entity._id),
            action: `<a href="/order/${entity._id}">Order-${entity.orderNo}</a> status changed to Paid`,
            isNotification: true,
            isRead: true,
            isReadByCustomer: false,
            color: 'green',
        },
        orderDeleted: {
            ...commons('user', actor._id),
            action: `<a href="/order/${entity._id}">Order-${entity.orderNo}</a> deleted`,
            color: 'red',
        },
        customerOrderDeleted: order
            ? {
                ...commons('customer', entity._id),
                action: `<a href="/order/${order._id}">Order-${order.orderNo}</a> deleted`,
                color: 'red',
                isRead: true,
                isReadByCustomer: false,
                isNotification: true,
            }
            : null,
        // NEW CHANGES FROM 19 JAN 2025
        entryNewFile:
            file && project
                ? {
                    ...commons('entry', entity._id),
                    action: `Document <a file-id="${file._id}" onclick="getFileModal(this)" class="fw-bold">${file.name}</a> added to <a href="/entry/${entity._id}/project/${project.slug}">${entity.name}</a> `,
                    color: 'blue',
                }
                : null,
        entryChangeFile:
            file && project && changes
                ? {
                    ...commons('entry', entity._id),
                    action: `Document <a file-id="${file._id}" onclick="getFileModal(this)" class="fw-bold">${file.name}</a> properties updated in <a href="/entry/${entity._id}/project/${project.slug}">${entity.name}</a> `,
                    color: 'blue',
                    changes,
                }
                : null,
        entryDeletedFile:
            file && project
                ? {
                    ...commons('user', actor._id),
                    action: `Document <span class="fw-bold">${file.name}</span> deleted in <a href="/entry/${entity._id}/project/${project.slug}">${entity.name}</a> `,
                    color: 'red',
                }
                : null,
        orderNewFile: file
            ? {
                ...commons('order', entity._id),
                action: `Document <span class="fw-bold">${file.name}</span> added to <a href="/order/${entity._id}">Order-${entity.orderNo}</a> `,
                color: 'blue',
                isNotification: true,
                isReadByCustomer: false,
            }
            : null,
        orderChangeFile:
            file && changes
                ? {
                    ...commons('order', entity._id),
                    action: `Document <span class="fw-bold">${file.name}</span> updated in <a href="/order/${entity._id}">Order-${entity.orderNo}</a> `,
                    color: 'blue',
                    changes,
                }
                : null,
        orderDeletedFile: file
            ? {
                ...commons('user', actor._id),
                action: `Document <span class="fw-bold">${file.name}</span> deleted in <a href="/order/${entity._id}">Order-${entity.orderNo}</a> `,
                color: 'red',
            }
            : null,
        // NEW CHANGES FROM 12 JUN 2025
        orderUpdateSent: message ? {
            ...commons('order', entity._id),
            action: `Status updated in <a href="/order/${entity._id}">Order-${entity.orderNo}</a> <br> <span class="fst-italic">${message}</span>`,
            color: 'blue',
            isNotification: true,
            isRead: true,
            isReadByCustomer: true,
        } : null,
        // entryUpdateSent: message && project ? {
        //     ...commons('entry', entity._id),
        //     action: `<a href="/entry/${entity._id}/project/${project.slug}">${entity.name}</a> updated. <br> <span class="badge bg-red-lt mt-1">Status</span> ${message}`,
        //     color: 'blue',
        //     isNotification: true,
        //     isRead: true,
        //     isReadByCustomer: false,
        // } : null,
        // customerEntryUpdateSent: message && project && entry ? {
        //     ...commons('customer', entity._id),
        //     action: `<a href="/entry/${entry._id}/project/${project.slug}">${entry.name}</a> updated. <br> <span class="badge bg-red-lt mt-1">Status</span> ${message}`,
        //     color: 'blue',
        //     isNotification: true,
        //     isRead: true,
        //     isReadByCustomer: false,
        // } : null,
        customerCreatedFromSolidus: {
            ...commons('customer', entity._id),
            action: `<a href="/customer/${entity._id}">${entity.name}</a> profile imported from solidus.`,
            color: 'blue',
            isNotification: false,
        },
        customerCreatedFromSharePoint: {
            ...commons('customer', entity._id),
            action: `<a href="/customer/${entity._id}">${entity.name}</a> profile imported from share point.`,
            color: 'blue',
            isNotification: false,
        },
        // NEW CHANGES FROM 27 JUN 2025
        customerEmailUpdated: message ? {
            ...commons('customer', entity._id),
            action: message,
            color: 'blue',
            isNotification: true,
            isRead: true,
            isReadByCustomer: false,
        } : null,
        entrySponsorshipStopped: project && entry ? {
            ...commons('entry', entity._id),
            action: `<a href="/entry/${entity._id}/project/${project.slug}">${entity.name || entity.nameOfOrphan || 'Entry'}
            </a> sponship stopped.`,
            project,
            changes,
            color: 'blue',
            isNotification: true,
            isRead: true,
            isReadByCustomer: false,
        } : null,
        customerEntryReplaced: project && order ? {
            ...commons('customer', entity._id),
            action: `<a href="/order/${order._id}">Order ${order.orderNo}</a> updated.`,
            project,
            changes,
            color: 'blue',
            isNotification: true,
            isRead: true,
            isReadByCustomer: false,
        } : null,
        orderEntryReplaced: project ? {
            ...commons('order', entity._id),
            action: `<a href="/order/${entity._id}">Order ${entity.orderNo}</a> updated.`,
            project,
            changes,
            color: 'blue',
            isNotification: true,
            isRead: true,
            isReadByCustomer: false,
        } : null,
    };

    if (templates[type] == null) {
        throw new Error(`Incomplete parameters for template type: ${type}`);
    }

    if (!templates[type]) {
        throw new Error(`Unknown log template type: ${type}`);
    }

    return templates[type];

};

module.exports = { logTemplates };
