<?php
// Allow access from any origin
header("Access-Control-Allow-Origin: *");

// URL of the original songs directory
$songsUrl = 'https://test.brightjuniors.in/spotify/songs/default/';

// Fetch the content from the original URL
$response = file_get_contents($songsUrl);

// Output the response
echo $response;
?>
