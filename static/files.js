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
