const getModalData = function (modal) {
    const select = $(modal).find('[name=randomBeneficiaries]').val();
    const search = $(modal).find('[name=specificBeneficiaries]').val();
    const customerId = $(modal).find('[name=customerId]').val();
    const currency = $(modal).find('[name=currency]').val();
    const slug = $(modal).find('[name=projectSlug]').val();

    return {
        select,
        search,
        customerId,
        currency,
        slug,
    };
};

const searchBeneficiaries = function (elem) {
    let error;

    const modal = $(elem).closest('.modal');

    const { select, search, customerId, currency, slug } = getModalData(modal);

    $(modal)
        .find('.search-beneficiaries')
        .find('.form-control')
        .removeClass('is-invalid');
    $(modal).find('.search-beneficiaries').find('.invalid-feedback').remove();
    $(modal).find('.total-cost').remove();

    if (select == '' && search == '') {
        error =
            'Please fill either the random or specific beneficiary input field.';
        $(modal)
            .find('.search-beneficiaries')
            .find('.form-control')
            .addClass('is-invalid');
        $(modal)
            .find('.search-beneficiaries')
            .append(`<div class='invalid-feedback d-block'>${error}</div>`);
        return false;
    }

    const projectExistsInOrder = $(modal).find(`.${slug}`).length > 0;
    const orderAlreadyCreated = $(modal).find('.project-in-order').length > 0;

    let url = `/getPaymentModalEntryData/${slug}/${customerId}?currency=${currency}&select=${select}&search=${search}`;

    if (orderAlreadyCreated) {
        const orderId = $(modal).find(`.project-in-order`).attr('orderId');
        if (projectExistsInOrder) {
            const toggleState = $(modal).find(`.${slug}`).attr('toggleState');
            url =
                url +
                `&orderId=${orderId}&replaceProject=true&toggleState=${toggleState}`;
        } else {
            url = url + `&orderId=${orderId}&addProject=true&toggleState=hide`;
        }
    } else {
        url = url + `&toggleState=hide`;
    }

    $.ajax({
        url,
        method: 'GET',
        namespace: 'spinner-on-cart',
        success: (response) => {
            $(modal).find('.error').remove();
            const elemExists = $(modal).find(`.${slug}`).length > 0;
            if (elemExists) {
                $(modal).find(`.${slug}`).replaceWith(response);
            } else {
                $(modal)
                    .find('.search-results-payment-modal-entries')
                    .append(response);
            }
            const orderId = $(modal).find('.project-in-order').attr('orderId');
            updateTotalCost(modal);
            if (!orderId) return;
            $(modal)
                .find('.invoice-frame')
                .attr({ src: `/invoice/${orderId}` })
                .removeClass('d-none');
        },
        error: (error) => {
            alert(error.responseText);
        },
    });
};

const doSearch = function (elem, href) {
    const modal = $(elem).closest('.modal');
    $(modal).find('.total-cost').remove();
    const isDashboardPage =
        $(elem).closest('.card-footer').attr('page-type') == 'orders';

    if (isDashboardPage) {
        loadOrderInContainer(elem, href);
        return;
    }

    if (!href) {
        href = $(elem).attr('my-href');
    }

    const customerId = $(modal).find('[name=customerId]').val();
    const slug = $(elem).closest('.card').attr('projectSlug');
    const orderId = $(modal).find(`.${slug}`).attr('orderId');
    const toggleState = $(modal).find(`.${slug}`).attr('toggleState');
    const url = `/getPaymentModalEntryData/${slug}/${customerId}${href}&orderId=${orderId}&toggleState=${toggleState}`;

    $.ajax({
        url,
        method: 'GET',
        namespace: 'spinner-on-cart',
        success: function (response) {
            $(modal).find(`.${slug}`).replaceWith(response);
            $(modal)
                .find('.invoice-frame')
                .attr({ src: `/invoice/${orderId}` })
                .removeClass('d-none');
            updateTotalCost(modal);
        },
        error: function (error) {
            alert(error.responseText);
        },
    });
};

const removeProject = function (elem) {
    // const orderHasProjects =
    // $(elem).closest('.project-in-order').siblings('.project-in-order')
    // .length > 0;
    const href = '?deleteProject=true';
    doSearch(elem, href);
    $(elem).closest('.card').remove();

    return;

    if (orderHasProjects) {
        const href = '?deleteProject=true';
    } else {
        const href = '?removeProject=true';
        doSearch(elem, href);
        $('#search-results-payment-modal-entries').html('');
    }
};

const selectAllSearchResults = function (elem) {
    const count = $(elem).data('limit');
    if ($(elem).html() == `Select all(${count})`) {
        $('#last-paid-entries')
            .find('[type="checkbox"]:not(":checked")')
            .click();
        $(elem).html(`Unselect all(${count})`);
    } else {
        $('#last-paid-entries').find('[type="checkbox"]:checked').click();
        $(elem).html(`Select all(${count})`);
    }
};

const toggleSearchResults = function (elem) {
    const projectTable = $(elem).closest('.card').find('.last-paid-entries');
    if (projectTable.hasClass('d-none')) {
        projectTable.removeClass('d-none');
        $(elem).closest('.card-header').removeClass('border-0');
        $(elem).closest('.card').attr({ toggleState: 'show' });
    } else {
        projectTable.addClass('d-none');
        $(elem).closest('.card-header').addClass('border-0');
        $(elem).closest('.card').attr({ toggleState: 'hide' });
    }
};

const toggleColumnSelect = function (elem) {
    const active = $(elem).hasClass('bg-green-lt');
    const colIndex = $(elem).closest('th').index();
    const isTotal = $(elem).closest('th').index() == 0;

    const rowHeadings = $(elem)
        .closest('table')
        .find('tr')
        .find('th:eq(0), td:eq(0)');

    if (isTotal && active) {
        $(elem)
            .closest('table')
            .find(`tr`)
            .each(function () {
                const button = $(this)
                    .find(`td, th`)
                    .find('button.bg-green-lt');
                $(button).removeClass('bg-green-lt');
                $(button).find('.icon-tabler-check').addClass('d-none');
                $(button).find('.icon-tabler-plus').removeClass('d-none');
            });
    } else if (isTotal && !active) {
        $(elem)
            .closest('table')
            .find(`tr`)
            .each(function () {
                const button = $(this)
                    .find(`td, th`)
                    .find('button:not(.bg-green-lt)');
                $(button).addClass('bg-green-lt');
                $(button).find('.icon-tabler-check').removeClass('d-none');
                $(button).find('.icon-tabler-plus').addClass('d-none');
            });
    } else if (!isTotal && active) {
        $(elem)
            .closest('table')
            .find(`tr`)
            .each(function () {
                const button = $(this)
                    .find(`td, th`)
                    .eq(colIndex)
                    .find('button');
                $(button).removeClass('bg-green-lt');
                $(button).find('.icon-tabler-check').addClass('d-none');
                $(button).find('.icon-tabler-plus').removeClass('d-none');
            });
        rowHeadings.find('button').removeClass('bg-green-lt');
        rowHeadings.find('.icon-tabler-check').addClass('d-none');
        rowHeadings.find('.icon-tabler-plus').removeClass('d-none');
    } else if (!isTotal && !active) {
        $(elem)
            .closest('table')
            .find(`tr`)
            .each(function () {
                const button = $(this)
                    .find(`td, th`)
                    .eq(colIndex)
                    .find('button');
                $(button).addClass('bg-green-lt');
                $(button).find('.icon-tabler-check').removeClass('d-none');
                $(button).find('.icon-tabler-plus').addClass('d-none');
            });
        const rowEntries = $(elem).closest('table').find('tr');
        rowEntries.each(function () {
            const isHeadingRow = $(this).find('th').length > 0;
            let allBtnsInRow, allSelectedBtns;
            if (isHeadingRow) {
                allBtnsInRow = $(this).find('th:not(:eq(0))').find('button');
                allSelectedBtns = $(this)
                    .find('th:not(:eq(0))')
                    .find('button.bg-green-lt');
            } else {
                allBtnsInRow = $(this).find('td:not(:eq(0))').find('button');
                allSelectedBtns = $(this)
                    .find('td:not(:eq(0))')
                    .find('button.bg-green-lt');
            }
            if (allBtnsInRow.length == allSelectedBtns.length) {
                const button = $(this)
                    .closest('tr')
                    .find('td:eq(0), th:eq(0)')
                    .find('button');
                button.addClass('bg-green-lt');
                button.find('.icon-tabler-check').removeClass('d-none');
                button.find('.icon-tabler-plus').addClass('d-none');
            }
        });
    }

    let subscriptions;

    subscriptions = $(elem)
        .closest('tr')
        .find('.bg-green-lt')
        .map((index, val) => $(val).attr('subscriptionName'))
        .get()
        .join(',');

    if (subscriptions == '') {
        subscriptions = 'empty';
    }

    const href =
        $(elem).closest('.card').attr('my-href') +
        `&subscriptions=${subscriptions}`;
    doSearch(elem, href);
};

const toggleCostSelect = function (elem) {
    const elemState = $(elem).hasClass('bg-green-lt');
    const rowState = $(elem)
        .closest('tr')
        .find('button')
        .eq(0)
        .hasClass('bg-green-lt');
    const colIndex = $(elem).closest('td').index();
    const row = $(elem).closest('td').closest('tr');
    const table = $(elem).closest('td').closest('table');

    const isTotalColumn = $(table).find('th').eq(colIndex).index() === 0;

    if (isTotalColumn && rowState) {
        $(row).find('button').removeClass('bg-green-lt');
        $(row).find('.icon-tabler-check').addClass('d-none');
        $(row).find('.icon-tabler-plus').removeClass('d-none');

        $(row)
            .find('button')
            .each(function () {
                unselectColRowHeading(this);
            });
    } else if (isTotalColumn && !rowState) {
        $(row).find('button').addClass('bg-green-lt');
        $(row).find('.icon-tabler-check').removeClass('d-none');
        $(row).find('.icon-tabler-plus').addClass('d-none');
        $(table)
            .find('button')
            .each(function () {
                selectColRowHeading(this);
            });
    } else if (!isTotalColumn && elemState) {
        $(elem).removeClass('bg-green-lt').find('svg').toggleClass('d-none');
        unselectColRowHeading(elem);
    } else if (!isTotalColumn && !elemState) {
        $(elem).addClass('bg-green-lt').find('svg').toggleClass('d-none');
        selectColRowHeading(elem);
    }

    let subscriptions = $(elem)
        .closest('tr')
        .find('.bg-green-lt')
        .map((index, val) => $(val).attr('subscriptionName'))
        .get()
        .join(',');

    if (subscriptions == '') {
        subscriptions = 'empty';
    }

    const entryId = $(elem).closest('tr').attr('entry-id');

    const href =
        $(elem).closest('.card').attr('my-href') +
        `&entryId=${entryId}&subscriptions=${subscriptions}`;
    doSearch(elem, href);
};

const selectColRowHeading = function (elem) {
    const index = $(elem).closest('td, th').index();
    const rowHeading = $(elem).closest('tr').find('td:eq(0) > button');
    const colHeading = $(elem)
        .closest('table')
        .find('th')
        .eq(index)
        .find('button');
    const totalHeading = $(elem)
        .closest('table')
        .find('tr:eq(0)')
        .find('button:eq(0)');

    const rowEntries = $(elem).closest('tr').find('td:not(:eq(0))');
    const colEntries = $(elem)
        .closest('table')
        .find(`td:nth-child(${index + 1})`);

    const fullRowSelected =
        rowEntries.find('.bg-green-lt').length ==
        rowEntries.find('button').length;
    const fullColSelected =
        colEntries.find('.bg-green-lt').length ==
        colEntries.find('button').length;

    if (fullRowSelected) {
        rowHeading.addClass('bg-green-lt');
        rowHeading.find('.icon-tabler-check').removeClass('d-none');
        rowHeading.find('.icon-tabler-plus').addClass('d-none');
    }

    if (fullColSelected) {
        colHeading.addClass('bg-green-lt');
        colHeading.find('.icon-tabler-check').removeClass('d-none');
        colHeading.find('.icon-tabler-plus').addClass('d-none');
    }

    if (fullRowSelected && fullColSelected) {
        const allSelectedEntries = $(elem)
            .closest('table')
            .find('tr:not(:eq(0))')
            .find('td:not(:eq(0))')
            .find('button.bg-green-lt');
        const allEntries = $(elem)
            .closest('table')
            .find('tr:not(:eq(0))')
            .find('td:not(:eq(0))')
            .find('button');
        if (allEntries.length == allSelectedEntries.length) {
            totalHeading.addClass('bg-green-lt');
            totalHeading.find('.icon-tabler-check').removeClass('d-none');
            totalHeading.find('.icon-tabler-plus').addClass('d-none');
        }
    }
};

const unselectColRowHeading = function (elem) {
    const index = $(elem).closest('td').index();
    const rowHeading = $(elem).closest('tr').find('td:eq(0) > button');
    const colHeading = $(elem)
        .closest('table')
        .find('th')
        .eq(index)
        .find('button');
    const totalHeading = $(elem)
        .closest('table')
        .find('tr:eq(0)')
        .find('button:eq(0)');
    const combinedElements = $()
        .add(rowHeading)
        .add(colHeading)
        .add(totalHeading);
    combinedElements.removeClass('bg-green-lt');
    combinedElements.find('.icon-tabler-check').addClass('d-none');
    combinedElements.find('.icon-tabler-plus').removeClass('d-none');
};

$(document).on('change', '.modal .order-change', function (e) {
    const modal = $(this).closest('.modal');

    const orderAlreadyCreated = $(modal).find('.project-in-order').length > 0;

    if (!orderAlreadyCreated) return;

    const { customerId, currency, select, search } = getModalData(modal);

    $(modal)
        .find('.project-in-order')
        .each((key, project) => {
            const orderId = $(modal).find(`.project-in-order`).attr('orderId');
            const slug = $(project).attr('projectSlug');
            const toggleState = $(modal).find(`.${slug}`).attr('toggleState');
            const url = `/getPaymentModalEntryData/${slug}/${customerId}?customerId=${customerId}&currency=${currency}&orderId=${orderId}&select=${select}&search=${search}&toggleState=${toggleState}`;

            $.ajax({
                url,
                method: 'GET',
                namespace: 'spinner-on-cart',
                success: (response) => {
                    $(modal).find('.error').remove();
                    $(modal).find(`.${slug}`).replaceWith(response);
                    $(modal)
                        .find('.invoice-frame')
                        .attr({ src: `/invoice/${orderId}` })
                        .removeClass('d-none');
                    updateTotalCost(modal);
                },
                error: (error) => {
                    alert(error.responseText);
                },
            });
        });
});

const updateTotalCost = function (modal) {
    const orderId = $(modal).find('.project-in-order').attr('orderId');
    if (!orderId) {
        $(modal).find('.total-cost').remove();
        return;
    }
    $.ajax({
        url: `/getOrderTotalCost/${orderId}`,
        method: 'GET',
        namespace: 'spinner-on-cart',
        success: (response) => {
            $(modal).find('.total-cost').remove();
            $(modal)
                .find('.search-results-payment-modal-entries')
                .append(response);
        },
        error: (error) => {
            alert(error.responseText);
        },
    });
};

$(document).on('ajaxStart.spinner-on-cart', function () {
    var modal = $('.modal:visible');
    if (modal.length) {
        $(modal)
            .find('.submit-btn')
            .html(
                `<span class="spinner-border spinner-border-sm" role="status"></span>`,
            );
    }
});

$(document).on('ajaxStop.spinner-on-cart', function () {
    var modal = $('.modal:visible');
    $(modal)
        .find('.submit-btn')
        .html(
            `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    class="icon icon-tabler icons-tabler-outline icon-tabler-shopping-cart-plus">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M4 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                    <path d="M12.5 17h-6.5v-14h-2" />
                    <path d="M6 5l14 1l-.86 6.017m-2.64 .983h-10.5" />
                    <path d="M16 19h6" />
                    <path d="M19 16v6" />
                  </svg>
                `,
        );
});

const loadPaymentModal = function (elem) {
    const modal = $(elem).closest('.modal');
    const modalFooter = $(elem).closest('.modal-footer');
    const orderId = $(modal).find(`.project-in-order`).attr('orderId');
    $(modal).find('.alert').remove();
    if (!orderId) {
        modalFooter.append(`
          <div class="alert alert-danger mt-4 w-100" role="alert">
            <h4 class="alert-title">Failed!</h4>
            <div class="text-secondary text-break">No beneficiaries selected. </div>
          </div>
          `);
        return;
    }
    let currentBtnHTML = $(elem).html();
    $(elem).html(
        `<span class="spinner-border spinner-border-sm me-2" role="status"></span>Updating Order`,
    );
    $.ajax({
        url: `/checkout/${orderId}`,
        method: 'GET',
        success: (response) => {
            $(elem).html(currentBtnHTML);
            getPaymentModal(elem);
        },
        error: (error) => {
            $(elem).html(currentBtnHTML);
            modalFooter.append(`
                <div class="alert alert-danger mt-4 w-100" role="alert">
                  <h4 class="alert-title">Failed to load payment modal!</h4>
                  <div class="text-secondary text-break">${error.responseText}</div>
                </div>
                `);
        },
    });
};

const getPaymentModal = function (elem) {
    const modal = $(elem).closest('.modal');
    const orderId = $(modal).find(`.project-in-order`).attr('orderId') || $(elem).attr('order-id');

    if (!orderId) {
        alert('No order found');
        return;
    }

    const modalExists =
        $(document).find(`#button-modal-payment-${orderId}`).length > 0;

    if (modalExists) {
        $(`#button-modal-payment-${orderId}`).trigger('click');
        return;
    }

    let currentBtnHTML = $(elem).html();
    $(elem).html(
        `<span class="spinner-border spinner-border-sm me-2" role="status"></span>`,
    );

    $.ajax({
        url: `/getPaymentModal/${orderId}`,
        method: 'GET',
        success: (response) => {
            $(elem).html(currentBtnHTML);
            $('footer').before(response);
            $(`#button-modal-payment-${orderId}`).trigger('click');
        },
        error: (error) => {
            $(elem).html(currentBtnHTML);
            alert(error);
        },
    });
};