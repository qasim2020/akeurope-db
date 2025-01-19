const uploadNewFile = function (elem) {
    const fileInput = $('<input>', {
        type: 'file',
        class: 'd-none',
        accept: 'application/pdf',
    });

    $('body').append(fileInput);

    const entityId = $(elem).attr('entity-id');
    const entityType = $(elem).attr('entity-type');
    const entityUrl = $(elem).attr('entity-url');
    const fileUrl = $(elem).attr('file-url');

    fileInput.trigger('click');

    fileInput.on('change', function () {
        const file = this.files[0];

        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('entityId', entityId);
            formData.append('entityType', entityType);
            formData.append('entityUrl', entityUrl);

            $.ajax({
                url: fileUrl,
                type: 'POST',
                data: formData,
                contentType: false,
                processData: false,
                success: function (response) {
                    console.log('File uploaded successfully:', response);
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

const getFileModal = function(elem) {

    const fileId = $(elem).attr("file-id");

    const modalExists = $(document).find(`#button-${fileId}`).length > 0;

    if (modalExists) {
      return $(`#button-${fileId}`).trigger("click");
    }

    $.ajax({
      url: `/getFileModal/${fileId}`,
      type: 'GET',
      contentType: 'application/json',
      success: function (response) {
        console.log(response);
        $("footer").before(response);
        $(`#button-${fileId}`).trigger("click");
      },
      error: function (xhr, status, error) {
        alert(xhr.responseText);
      }
    }); 
}

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
