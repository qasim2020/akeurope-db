const uploadNewFile = function (elem) {
    const fileInput = $('<input>', {
        type: 'file',
        class: 'd-none',
        accept: 'application/pdf',
    });

    $('body').append(fileInput);

    const entityId = $('#files-container').attr('entity-id');
    const entityType = $('#files-container').attr('entity-type');
    const entityUrl = $('#files-container').attr('entity-url');
    const fileUrl = $('#files-container').attr('file-url');
    const entitySlug = $('#files-container').attr('entity-slug');

    const elemHtml = $(elem).html();

    fileInput.trigger('click');

    fileInput.on('change', function () {
        const file = this.files[0];

        if (file) {
            $(elem).html(`
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Uploading
            `);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('entityId', entityId);
            formData.append('entityType', entityType);
            formData.append('entityUrl', entityUrl);
            formData.append('entitySlug', entitySlug);

            $.ajax({
                url: fileUrl,
                type: 'POST',
                data: formData,
                contentType: false,
                processData: false,
                success: function (response) {
                    $(elem).html(elemHtml);
                    getFileModal(null, response._id);
                    renderFiles();
                    refreshContainers();
                },
                error: function (xhr, status, error) {
                    alert(error);
                    console.error('Error uploading file:', error);
                },
            });
        }

        fileInput.remove();
    });
};

const getFileModal = function (elem, fileId) {
    if (!fileId) {
        fileId = $(elem).attr('file-id');
    }

    const modalExists = $(document).find(`#button-${fileId}`).length > 0;

    if (modalExists) {
        $(`#modal-${fileId}`).remove();
        $(`#button-${fileId}`).remove();
    }

    $.ajax({
        url: `/getFileModal/${fileId}`,
        type: 'GET',
        contentType: 'application/json',
        success: function (response) {
            $('footer').before(response);
            $(`#button-${fileId}`).trigger('click');
        },
        error: function (xhr, status, error) {
            alert(xhr.responseText);
        },
    });
};

const updateFile = function (elem) {
    const modal = $(elem).closest('.modal');

    const fileId = $(modal).attr('file-id');
    const name = $(modal).find('[name=fileName]').val();
    const notes = $(modal).find('[name=fileNotes').val();
    const category = $(modal).find('[name=fileCategory]:checked').val();
    const access = $(modal)
        .find('[name="fileAccess"]:checked')
        .map(function () {
            return $(this).val();
        })
        .get();
    const entityType = $('#files-container').attr('entity-type');
    const entityId = $('#files-container').attr('entity-id');
    const entitySlug = $('#files-container').attr('entity-slug');

    if (!name || !category) {
        alert('File name and category are required');
        return;
    }

    const elemHtml = $(elem).html();
    $(elem).html(`
        <span class="spinner-border spinner-border-sm me-2" role="status"></span>
        Saving File
        `);

    $.ajax({
        url: `/fileUpdate/${fileId}`,
        method: 'POST',
        data: JSON.stringify({ name, category, notes, access, entityType, entityId, entitySlug }),
        contentType: 'application/json',
        success: (response) => {
            console.log(response);
            $(elem).html(elemHtml);
            modal.modal('hide');
            renderFiles();
            refreshContainers();
        },
        error: (error) => {
            console.log(error);
            alert(error);
            $(elem).html(elemHtml);
        },
    });
};

const deleteFile = function (elem) {
    const modal = $(elem).closest('.modal');
    const fileId = $(modal).attr('file-id');


    const entityType = $('#files-container').attr('entity-type');
    const entityId = $('#files-container').attr('entity-id');
    const entitySlug = $('#files-container').attr('entity-slug');

    const elemHtml = $(elem).html();
    $(elem).html(`
        <span class="spinner-border spinner-border-sm me-2" role="status"></span>
        Deleting
        `);
    $.ajax({
        url: `/fileDelete/${fileId}`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({entityId, entityType, entitySlug}),
        success: function (response) {
            renderFiles();
            refreshContainers();
            $(elem).html('File Deleted');
            modal.modal('hide');
        },
        error: function (xhr, status, error) {
            $(elem).html(elemHtml);
            alert(xhr.responseText);
        },
    });
};

const renderFiles = function () {
    const entityId = $(document).find('#files-container').attr('entity-id');
    if (!entityId) {
        $('#files-container');
        alert('no entity id found');
        return;
    }
    $.ajax({
        url: `/filesByEntityRender/${entityId}`,
        method: 'GET',
        contentType: 'application/json',
        success: function (response) {
            $('#files-container').html(response);
        },
        error: function (xhr, status, error) {
            alert(xhr.responseText);
        },
    });
};

const renderUnlinkedFile = function (elem) {
    const fileName = $(elem).attr('file-name');
    $(elem).siblings().removeClass('selected');
    $(elem).addClass('selected');
    $.ajax({
        url: `/unlinkedFile/${fileName}`,
        method: 'GET',
        success: (response) => {
            $('#file-container').html(response);
        },
        error: (error) => {
            alert(error);
        },
    });
};

const getFileDetails = function (elem) {
    const fileId = $(elem).attr('file-id');
    $.ajax({
        url: `/file/${fileId}`,
        method: 'GET',
        success: (response) => {
            $('#file-container').html(response);
        },
        error: (error) => {
            alert(error);
        },
    });
};
