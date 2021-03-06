<?php

// autoload_static.php @generated by Composer

namespace Composer\Autoload;

class ComposerStaticInit4a4e0e985ef68770d710dc260edc44ab
{
    public static $files = array (
        '2cffec82183ee1cea088009cef9a6fc3' => __DIR__ . '/..' . '/ezyang/htmlpurifier/library/HTMLPurifier.composer.php',
    );

    public static $prefixLengthsPsr4 = array (
        'P' => 
        array (
            'Pelago\\' => 7,
        ),
    );

    public static $prefixDirsPsr4 = array (
        'Pelago\\' => 
        array (
            0 => __DIR__ . '/..' . '/pelago/emogrifier/Classes',
        ),
    );

    public static $prefixesPsr0 = array (
        'P' => 
        array (
            'Parsedown' => 
            array (
                0 => __DIR__ . '/..' . '/erusev/parsedown',
            ),
        ),
        'H' => 
        array (
            'HTMLPurifier' => 
            array (
                0 => __DIR__ . '/..' . '/ezyang/htmlpurifier/library',
            ),
        ),
    );

    public static function getInitializer(ClassLoader $loader)
    {
        return \Closure::bind(function () use ($loader) {
            $loader->prefixLengthsPsr4 = ComposerStaticInit4a4e0e985ef68770d710dc260edc44ab::$prefixLengthsPsr4;
            $loader->prefixDirsPsr4 = ComposerStaticInit4a4e0e985ef68770d710dc260edc44ab::$prefixDirsPsr4;
            $loader->prefixesPsr0 = ComposerStaticInit4a4e0e985ef68770d710dc260edc44ab::$prefixesPsr0;

        }, null, ClassLoader::class);
    }
}
